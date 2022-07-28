import * as vscode from 'vscode';
import * as cp from "child_process";
import * as fs from 'fs';

//Class containing a promise for executing a shellCommand and also the child process running the command
export class ShellCommand{
    shellPromise;
    shellProcess;

    constructor(shellPromise: Promise<String>, shellProcess: any) {
        this.shellPromise = shellPromise;
        this.shellProcess = shellProcess;
    }
}

export const workspacePath = vscode?.workspace?.workspaceFolders?.[0].uri.path;
//Creates the extension output channel
export const dxmateOutput = vscode.window.createOutputChannel("DX Mate");

export function getFile(filePath: string) {
	//Returrn the file using fs
    return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : null;
}

export function createFile(absPath: string, data: string) {
    fs.writeFileSync(absPath, data);
}

export function folderExists(path: string) {
    return fs.existsSync(path);
}

export function createFolder(absPath: string) {
    fs.mkdirSync(absPath);
}

export function getDirectories(absPath: string) {
    return fs.readdirSync(absPath).filter(function (file) {
      return fs.statSync(absPath+'/'+file).isDirectory();
    });
}

//Use this to handle chained promises and command handling.
export function execShell(cmd: string) {
    let process = cp.exec(cmd, {cwd: workspacePath}, (err, out) => {
        if(err && err.signal !== 'SIGINT') {
            dxmateOutput.appendLine("An error occurred: \n " + err);
        }
    });

    let shellPromise = new Promise<string>((resolve, reject) => {
        dxmateOutput.appendLine("Running: " + cmd);
        dxmateOutput.show();

        //Stores output for the child_process in the onData event
        let output= "";

        const handleRetry = () => {
            vscode.window.showQuickPick(['YES', 'NO'], {
                title: "An error occurred, do you wish to retry?" ,
                canPickMany: false,
                placeHolder: 'YES'
            })
            .then(value => {
                if(value && value === 'YES') {
                    execShell(cmd);
                } else{
                    dxmateOutput.show();
                    return reject('Error');
                }
            });
        }

        process.on('exit', (code, signal) =>{
            if(signal === 'SIGINT') {
                dxmateOutput.appendLine("Process was cancelled");
                return reject('Cancelled');
            }

            if(code === 0) {
                dxmateOutput.appendLine("Finished running: " + cmd);
                return resolve(output);
            }
            else{
                handleRetry();
            }
        });

        process.stdout?.on('data', data => {
            output += data;
            //Adding stream to the output console for the process
            //Possibly give ability to see what subprocess is ongoing
            dxmateOutput.appendLine(data);
        });
    });
    return new ShellCommand(shellPromise, process);
}