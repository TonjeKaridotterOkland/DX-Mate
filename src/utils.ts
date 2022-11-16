import * as vscode from 'vscode';
import * as cp from "child_process";
import * as fs from 'fs';
import { EXTENSION_CONTEXT } from './models';

//Class containing a promise for executing a shellCommand and also the child process running the command
export class ShellCommand{
    shellPromise?: Promise<string>;
    shellProcess?: any;
    command: string;
    suppressOutput: boolean = false;

    constructor(command: string, suppressOutput?: boolean) {
        this.command = command;
        if(suppressOutput !== undefined) { this.suppressOutput = suppressOutput; }
    }

    public runCommand() {
        this.shellProcess = cp.exec(this.command, {cwd: workspacePath}, (err, out) => {
            if(err && err.signal !== 'SIGINT') {
                dxmateOutput.appendLine("An error occurred: \n " + err);
                dxmateOutput.show();
            }
        });
    
        this.shellPromise = new Promise<string>((resolve, reject) => {
            dxmateOutput.appendLine("Running: " + this.command);
            dxmateOutput.show();
    
            //Stores output for the child_process in the onData event
            let output= "";
    
            const handleRetry = () => {
                vscode.window.showErrorMessage(
                    'An error occurred. See DX-Mate output for info',
                    ...['Retry', 'Cancel']
                )
                .then(value => {
                    if(value === 'Retry') {
                        this.runCommand().shellPromise
                        ?.then(() => {
                            resolve('Retry success');
                        }).catch( err => {
                            reject('Retry error');
                        });
                    }
                    else{
                        return reject('Error');
                    }
                });
            };

            this.shellProcess.on('exit', (code: number, signal: string) =>{
                if(signal === 'SIGINT') {
                    dxmateOutput.appendLine("Process was cancelled");
                    return reject('Cancelled');
                }
    
                if(code === 0) {
                    dxmateOutput.appendLine("Finished running: " + this.command);
                    return resolve(output);
                }
                else{
                    handleRetry();
                }
            });
    
            if(this.suppressOutput === false) {
                this.shellProcess.stdout?.on('data', (data: string) => {
                    output += data;
                    //Adding stream to the output console for the process
                    //Possibly give ability to see what subprocess is ongoing
                    dxmateOutput.appendLine(data);
                });
            }
        });

        return this;
    }
}

export function refreshRunningTasks() {
    console.log('REFRESHING RUNNING TASKS');
    EXTENSION_CONTEXT.refreshRunningTasks();
}
/**
 * Get the sfdx-project.json file from current project
 * @returns 
 */
// eslint-disable-next-line
export function SFDX_PROJECT_JSON(): string {
    console.log('GETTING PROJECT JSON');
    return getFile(workspacePath + '/sfdx-project.json') as string;
}
/**
 * Check if the current project is a multi package project
 * @returns 
 */
// eslint-disable-next-line
export function IS_MULTI_PCKG_DIRECTORY(): boolean {
    let projJson = JSON.parse(SFDX_PROJECT_JSON());
    return projJson?.packageDirectories?.length > 1;
};
const workSpaceUri = vscode?.workspace?.workspaceFolders?.[0].uri;
export const workspacePath = workSpaceUri?.fsPath;
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

/**
 * Function to initiate terminal processes from vscode. input command to run and optional param to suppress output to the dxMate output channel
 * @param cmd 
 * @param suppressOutput 
 * @returns ShellCommand
 */
export function execShell(cmd: string, suppressOutput = false) {
    const shellCommand = new ShellCommand(cmd, suppressOutput);
    return shellCommand.runCommand();
}