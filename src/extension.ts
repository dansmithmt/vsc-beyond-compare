import * as vscode from 'vscode';

import { window, commands } from 'vscode';
import { posix } from 'path';
import { existsSync, open } from 'fs';

const cp = require('child_process');
let fillListDone = false;

//const pathHint = configuration.get<string>("path");
const svnConfig = vscode.workspace.getConfiguration("svn");
const bcConfig = vscode.workspace.getConfiguration("beyond-compare-diff");
const defaultConfig = vscode.workspace.getConfiguration("");

const nil = "";

export function showBeyondCompare(files: String[]) {
	//"C:\Program Files (x86)\Beyond Compare 4\BComp.exe" %base %mine /title1=%bname /title2=%yname /leftreadonly
	const beyondCompare = '"C:\\Program Files (x86)\\Beyond Compare 4\\BComp.exe"';
	const command = beyondCompare + ' ' + files.join(' ');
	console.log(command);
	cp.exec(command, (error: Error)=> {
		if (error) {
			 if (error.message.match(/is not recognized/)) {
			 	window.showErrorMessage("Beyond Compare is not installed! (" +beyondCompare +")");			
			 }
//			window.showErrorMessage(error.message);
		}
	});
}

export function showListAndDiff(current: String, possible_diffs: String[]) {
	// remove current editor
	let possible = possible_diffs.filter(function(value, index, arr) {
		return value !== current;
	});

	let a = Array();
	possible.forEach(_ => {
		a.push(_);
	});

	window.showQuickPick(a, {
		placeHolder: 'Filename to diff'
	}).then(result => {
		if (existsSync(result)) {
			showBeyondCompare([current, result]);
		}
	});
}

// workaround because there is no function to get all open editors from API
export function doIt(current: String, possible_diffs: String[]) {
	if (fillListDone) {
		showListAndDiff(current, possible_diffs);
	} else {
		if (window.activeTextEditor) {
			possible_diffs.push(window.activeTextEditor.document.fileName);
		}
		commands.executeCommand("workbench.action.nextEditor").then(_ => {
			if (window.activeTextEditor) {
				if (window.activeTextEditor.document.fileName !== current) {
					doIt(current, possible_diffs);
				} else {
					fillListDone = true;
					showListAndDiff(current, possible_diffs);
				}
			} else {
				// the window is not a text editor, skip it
				doIt(current, possible_diffs);
			}
		});
	}
}

export function activate(context: vscode.ExtensionContext) {
	let open_files_event = Array();

	vscode.workspace.onDidOpenTextDocument(event => {
		// add file to array on opening
		if (fillListDone && open_files_event.indexOf(event.fileName) === -1) {
			if (existsSync(event.fileName)) {
				open_files_event.push(event.fileName);
			}
		}
	});

	vscode.workspace.onDidCloseTextDocument(event => {
		//remove file from list on closing
		let index = open_files_event.indexOf(event.fileName);
		if (fillListDone && index !== -1) {
			open_files_event.splice(index, 1);
		}
	});

	context.subscriptions.push(vscode.commands.registerCommand('beyond-compare-diff.diffVisible', () => {
		let open_files: String[] = [];
		window.visibleTextEditors.forEach(editor => {
			open_files.push(editor.document.fileName.toString());
		});

		if (open_files.length < 2) {
			window.showErrorMessage("Beyond Compare:\nCan't diff: Only one file is visible in editor!");
			return;
		}
		if (open_files.length > 3) {
			window.showErrorMessage("Beyond Compare:\nCan't diff: More than three files are visible in editor!");
			return;
		}

		showBeyondCompare(open_files);
	}));

	context.subscriptions.push(vscode.commands.registerCommand('beyond-compare-diff.diffCurrentToOtherOpen', () => {
		let open_files: String[] = [];

		if (!window.activeTextEditor) {
			window.showErrorMessage("Beyond Compare:\nCurrent window is not a file!");
			return;
		}

		// add active file
		open_files.push(window.activeTextEditor.document.fileName);

		// let possible_diffs= Array();
		let current = window.activeTextEditor.document.fileName;

		doIt(current, open_files_event);
	}));

	context.subscriptions.push(vscode.commands.registerCommand('beyond-compare-diff.diffCurrentToOther', () => {
		if (!window.activeTextEditor) {
			window.showErrorMessage("Beyond Compare:\nNo file selected for diff!");
			return;
		}

		let current = window.activeTextEditor.document.fileName;

		const options: vscode.OpenDialogOptions = {
			canSelectMany: false,
			openLabel: 'Diff'
	   	};

		window.showOpenDialog(options).then(_ => {
			showBeyondCompare([current, String(_)]);
		});

	}));

	let selected:String = "";

	context.subscriptions.push(vscode.commands.registerCommand('beyond-compare-diff.diffFromFileListSelect', (_) => {
		console.log('beyond-compare-diff.diffFromFileListSelect');
		if (! _) {
			if (window.activeTextEditor) {
				selected = window.activeTextEditor.document.fileName;
			} else {
				return;
			}
		} else {
			selected = _.fsPath;
		}

		console.log('Selected: ' +selected);
	}));

	context.subscriptions.push(vscode.commands.registerCommand('beyond-compare-diff.diffFromFileList', (_) => {
		console.log('beyond-compare-diff.diffFromFileList');
		let path = "";
		if (! _) {
			if (window.activeTextEditor) {
				path = window.activeTextEditor.document.fileName;
			} else {
				return;
			}
		} else {
			path = _.fsPath;
		}
		if (selected.length > 0) {
			showBeyondCompare([selected, path]);
		} else {
			window.showErrorMessage("Beyond Compare: First select a file to compare to!");
		}
	}));
}

export function deactivate() {}
