"use strict";
var opn = require('opn');
var $ = require("jquery");
var Git = require("nodegit");
var fs = require("fs");
var async = require("async");
var readLine = require("read-each-line-sync");
var green = "#84db00";
var repo, index, oid, remote, commitMessage;
var filesToAdd = [];
var theirCommit = null;
function addAndCommit() {
    var repository;
    Git.Repository.open(repoFullPath)
        .then(function (repoResult) {
        repository = repoResult;
        console.log("1.0");
        return repository.refreshIndex();
    })
        .then(function (indexResult) {
        console.log("2.0");
        index = indexResult;
        var filesToStage = [];
        filesToAdd = [];
        var fileElements = document.getElementsByClassName('file');
        for (var i = 0; i < fileElements.length; i++) {
            var fileElementChildren = fileElements[i].childNodes;
            if (fileElementChildren[1].checked === true) {
                filesToStage.push(fileElementChildren[0].innerHTML);
                filesToAdd.push(fileElementChildren[0].innerHTML);
            }
        }
        console.log("2.1");
        return index.addAll(filesToStage);
    })
        .then(function () {
        console.log("3.0");
        return index.write();
    })
        .then(function () {
        console.log("4.0");
        return index.writeTree();
    })
        .then(function (oidResult) {
        console.log("5.0");
        oid = oidResult;
        return Git.Reference.nameToId(repository, "HEAD");
    })
        .then(function (head) {
        console.log("6.0");
        return repository.getCommit(head);
    })
        .then(function (parent) {
        console.log("7.0");
        var sign;
        if (username !== null && password !== null) {
            sign = Git.Signature.now(username, password);
        }
        else {
            sign = Git.Signature.default(repository);
        }
        commitMessage = document.getElementById('commit-message-input').value;
        if (theirCommit !== null) {
            return repository.createCommit("HEAD", sign, sign, commitMessage, oid, [parent, theirCommit]);
        }
        else {
            return repository.createCommit("HEAD", sign, sign, commitMessage, oid, [parent]);
        }
    })
        .then(function (oid) {
        theirCommit = null;
        console.log("Commit successful: " + oid.tostrS());
        hideDiffPanel();
        clearModifiedFilesList();
        clearCommitMessage();
        clearSelectAllCheckbox();
        for (var i = 0; i < filesToAdd.length; i++) {
            addCommand("git add " + filesToAdd[i]);
        }
        addCommand('git commit -m "' + commitMessage + '"');
        refreshAll(repository);
    }, function (err) {
        console.log(err);
        updateModalText("Oops, error occours! If u haven't login, please login and try again.");
    });
}
function clearModifiedFilesList() {
    var filePanel = document.getElementById("files-changed");
    while (filePanel.firstChild) {
        filePanel.removeChild(filePanel.firstChild);
    }
    var filesChangedMessage = document.createElement("p");
    filesChangedMessage.className = "modified-files-message";
    filesChangedMessage.id = "modified-files-message";
    filesChangedMessage.innerHTML = "Your modified files will appear here";
    filePanel.appendChild(filesChangedMessage);
}
function clearCommitMessage() {
    document.getElementById('commit-message-input').value = "";
}
function clearSelectAllCheckbox() {
    document.getElementById('select-all-checkbox').checked = false;
}
function getAllCommits(callback) {
    var repos;
    var allCommits = [];
    var aclist = [];
    console.log("1.0");
    Git.Repository.open(repoFullPath)
        .then(function (repo) {
        repos = repo;
        console.log("2.0");
        return repo.getReferences(Git.Reference.TYPE.LISTALL);
    })
        .then(function (refs) {
        var count = 0;
        console.log("3.0    " + refs.length);
        async.whilst(function () {
            return count < refs.length;
        }, function (cb) {
            if (!refs[count].isRemote()) {
                console.log("4.0");
                repos.getReferenceCommit(refs[count])
                    .then(function (commit) {
                    var history = commit.history(Git.Revwalk.SORT.Time);
                    history.on("end", function (commits) {
                        for (var i = 0; i < commits.length; i++) {
                            if (aclist.indexOf(commits[i].toString()) < 0) {
                                allCommits.push(commits[i]);
                                aclist.push(commits[i].toString());
                            }
                        }
                        count++;
                        console.log(count + "-------" + allCommits.length);
                        cb();
                    });
                    history.start();
                });
            }
            else {
                console.log('lalalalalalala');
                count++;
                cb();
            }
        }, function (err) {
            console.log(err);
            callback(allCommits);
        });
    });
}
function pullFromRemote() {
    var repository;
    var branch = document.getElementById("branch-name").innerText;
    Git.Repository.open(repoFullPath)
        .then(function (repo) {
        repository = repo;
        console.log("Pulling changes from remote...");
        addCommand("git pull");
        displayModal("Pulling new changes from the remote repository");
        return repository.fetchAll({
            callbacks: {
                credentials: function () {
                    return cred;
                },
                certificateCheck: function () {
                    return 1;
                }
            }
        });
    })
        .then(function () {
        repository.mergeBranches(branch, "origin/" + branch)
            .then(function () {
            refreshAll(repository);
            console.log("Pull successful");
            updateModalText("Pull successful");
        });
    });
}
function pushToRemote() {
    var branch = document.getElementById("branch-name").innerText;
    Git.Repository.open(repoFullPath)
        .then(function (repo) {
        console.log("Pushing changes to remote");
        displayModal("Pushing changes to remote...");
        addCommand("git push -u origin " + branch);
        repo.getRemotes()
            .then(function (remotes) {
            repo.getRemote(remotes[0])
                .then(function (remote) {
                return remote.push(["refs/heads/" + branch + ":refs/heads/" + branch], {
                    callbacks: {
                        credentials: function () {
                            return cred;
                        }
                    }
                });
            })
                .then(function () {
                console.log("Push successful");
                updateModalText("Push successful");
                refreshAll(repo);
            });
        });
    });
}
function createBranch() {
    var branchName = document.getElementById("branchName").value;
    console.log(branchName + "!!!!!!");
    Git.Repository.open(repoFullPath)
        .then(function (repo) {
        return repo.getHeadCommit()
            .then(function (commit) {
            return repo.createBranch(branchName, commit, 0, repo.defaultSignature(), "Created new-branch on HEAD");
        }, function (err) {
            console.log(err + "LLLLLL");
        });
    }).done(function () {
        console.log("All done!");
    });
}
function mergeLocalBranches(element) {
    var bn = element.innerHTML;
    var fromBranch;
    var repos;
    Git.Repository.open(repoFullPath)
        .then(function (repo) {
        repos = repo;
    })
        .then(function () {
        console.log("??????");
        return repos.getBranch("refs/heads/" + bn);
    })
        .then(function (branch) {
        console.log(branch.name());
        fromBranch = branch;
        return repos.getCurrentBranch();
    })
        .then(function (toBranch) {
        console.log(toBranch.name());
        return repos.mergeBranches(toBranch, fromBranch, repos.defaultSignature(), Git.Merge.PREFERENCE.NONE, null);
    })
        .then(function (index) {
        var text;
        console.log(index);
        if (index instanceof Git.Index) {
            text = "Conflicts Exist";
        }
        else {
            text = "Merge Successfully";
        }
        console.log(text);
        updateModalText(text);
        refreshAll(repos);
    });
}
function mergeCommits(from) {
    var repos;
    var index;
    Git.Repository.open(repoFullPath)
        .then(function (repo) {
        repos = repo;
        console.log("2.0  " + from);
        return Git.Reference.nameToId(repos, 'refs/heads/' + from);
    })
        .then(function (oid) {
        console.log("3.0  " + oid);
        return Git.AnnotatedCommit.lookup(repos, oid);
    })
        .then(function (annotated) {
        console.log("4.0  " + annotated);
        Git.Merge.merge(repos, annotated, null, {
            checkoutStrategy: Git.Checkout.STRATEGY.FORCE,
        });
        theirCommit = annotated;
    })
        .then(function () {
        if (fs.existsSync(repoFullPath + "/.git/MERGE_MSG")) {
            updateModalText("Conflicts exists! Please check files list on right side and solve conflicts before you commit again!");
            refreshAll(repos);
        }
        else {
            updateModalText("Successfully Merged!");
            refreshAll(repos);
        }
    });
}
function mergeInMenu(from) {
    var p1 = document.getElementById("fromMerge");
    var p3 = document.getElementById("mergeModalBody");
    p1.innerHTML = from;
    p3.innerHTML = "Do you want to merge branch " + from + " to HEAD ?";
    $("#mergeModal").modal('show');
}
function displayModifiedFiles() {
    var modifiedFiles = [];
    Git.Repository.open(repoFullPath)
        .then(function (repo) {
        console.log(repo.isMerging() + "ojoijnkbunmm");
        repo.getStatus().then(function (statuses) {
            statuses.forEach(addModifiedFile);
            if (modifiedFiles.length !== 0) {
                if (document.getElementById("modified-files-message") !== null) {
                    var filePanelMessage = document.getElementById("modified-files-message");
                    filePanelMessage.parentNode.removeChild(filePanelMessage);
                }
            }
            modifiedFiles.forEach(displayModifiedFile);
            function addModifiedFile(file) {
                var filePaths = document.getElementsByClassName('file-path');
                for (var i = 0; i < filePaths.length; i++) {
                    if (filePaths[i].innerHTML === file.path()) {
                        return;
                    }
                }
                var path = file.path();
                var modification = calculateModification(file);
                modifiedFiles.push({
                    filePath: path,
                    fileModification: modification
                });
            }
            function calculateModification(status) {
                if (status.isNew()) {
                    return "NEW";
                }
                else if (status.isModified()) {
                    return "MODIFIED";
                }
                else if (status.isDeleted()) {
                    return "DELETED";
                }
                else if (status.isTypechange()) {
                    return "TYPECHANGE";
                }
                else if (status.isRenamed()) {
                    return "RENAMED";
                }
                else if (status.isIgnored()) {
                    return "IGNORED";
                }
            }
            function displayModifiedFile(file) {
                var filePath = document.createElement("p");
                filePath.className = "file-path";
                filePath.innerHTML = file.filePath;
                var fileElement = document.createElement("div");
                if (file.fileModification === "NEW") {
                    fileElement.className = "file file-created";
                }
                else if (file.fileModification === "MODIFIED") {
                    fileElement.className = "file file-modified";
                }
                else if (file.fileModification === "DELETED") {
                    fileElement.className = "file file-deleted";
                }
                else {
                    fileElement.className = "file";
                }
                fileElement.appendChild(filePath);
                var checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.className = "checkbox";
                fileElement.appendChild(checkbox);
                document.getElementById("files-changed").appendChild(fileElement);
                fileElement.onclick = function () {
                    displayDiffPanel();
                    document.getElementById("diff-panel-body").innerHTML = "";
                    if (fileElement.className === "file file-created") {
                        printNewFile(file.filePath);
                    }
                    else {
                        printFileDiff(file.filePath);
                    }
                };
            }
            function printNewFile(filePath) {
                var fileLocation = require("path").join(repoFullPath, filePath);
                var lineReader = require("readline").createInterface({
                    input: fs.createReadStream(fileLocation)
                });
                lineReader.on("line", function (line) {
                    formatNewFileLine(line);
                });
            }
            function printFileDiff(filePath) {
                repo.getHeadCommit().then(function (commit) {
                    getCurrentDiff(commit, filePath, function (line) {
                        formatLine(line);
                    });
                });
            }
            function getCurrentDiff(commit, filePath, callback) {
                commit.getTree().then(function (tree) {
                    Git.Diff.treeToWorkdir(repo, tree, null).then(function (diff) {
                        diff.patches().then(function (patches) {
                            patches.forEach(function (patch) {
                                patch.hunks().then(function (hunks) {
                                    hunks.forEach(function (hunk) {
                                        hunk.lines().then(function (lines) {
                                            var oldFilePath = patch.oldFile().path();
                                            var newFilePath = patch.newFile().path();
                                            if (newFilePath === filePath) {
                                                lines.forEach(function (line) {
                                                    callback(String.fromCharCode(line.origin()) + line.content());
                                                });
                                            }
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            }
            function formatLine(line) {
                var element = document.createElement("div");
                if (line.charAt(0) === "+") {
                    element.style.backgroundColor = "#84db00";
                    line = line.slice(1, line.length);
                }
                else if (line.charAt(0) === "-") {
                    element.style.backgroundColor = "#ff2448";
                    line = line.slice(1, line.length);
                }
                element.innerText = line;
                document.getElementById("diff-panel-body").appendChild(element);
            }
            function formatNewFileLine(text) {
                var element = document.createElement("div");
                element.style.backgroundColor = green;
                element.innerHTML = text;
                document.getElementById("diff-panel-body").appendChild(element);
            }
        });
    }, function (err) {
        console.log("waiting for repo to be initialised");
    });
}
var content;
$.contextMenu({
    slector: ".file",
    callback: function (key, options) {
        content = $(this).text();
        console.log("You clicked on: " + content);
    },
    items: {
        "edit": {
            name: "Edit",
            icon: "edit",
            callback: function (itemKey, opt) {
                opn(repoFullPath + "/" + content);
            }
        }
    },
});
