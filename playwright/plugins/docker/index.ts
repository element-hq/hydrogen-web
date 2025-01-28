/*
Copyright 2025 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import * as os from "os";
import * as childProcess from "child_process";
import * as fse from "fs-extra";

export function dockerRun(args: {
    image: string;
    containerName: string;
    dockerParams?: string[];
    applicationParams?: string[];
}): Promise<string> {
    const userInfo = os.userInfo();
    const params = args.dockerParams ?? [];
    const appParams = args.applicationParams ?? [];

    if (userInfo.uid >= 0) {
        // On *nix we run the docker container as our uid:gid otherwise cleaning it up its media_store can be difficult
        params.push("-u", `${userInfo.uid}:${userInfo.gid}`);
    }

    return new Promise<string>((resolve, reject) => {
        childProcess.execFile('sudo', [
            "docker",
            "run",
            "--name", args.containerName,
            "-d",
            ...params,
            args.image,
            ... appParams
        ], (err, stdout) => {
            if (err) {
                reject(err);
            }
            resolve(stdout.trim());
        });
    });
}

export function dockerExec(args: {
    containerId: string;
    params: string[];
}): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        childProcess.execFile("sudo", [
            "docker",
            "exec", args.containerId,
            ...args.params,
        ], { encoding: 'utf8' }, (err, stdout, stderr) => {
            if (err) {
                console.log(stdout);
                console.log(stderr);
                reject(err);
                return;
            }
            resolve();
        });
    });
}

/**
 * Create a docker network; does not fail if network already exists
 */
export function dockerCreateNetwork(args: {
    networkName: string;
}): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        childProcess.execFile("sudo", [
            "docker",
            "network", 
            "create",
            args.networkName,
            "--subnet", "172.18.0.0/16"
        ], { encoding: 'utf8' }, (err, stdout, stderr) => {
            if(err) {
                if (stderr.includes(`network with name ${args.networkName} already exists`)) {
                    // Don't consider this as error
                    resolve();
                }
                reject(err);
                return;
            }
            resolve();
       }) 
    });
}

export async function dockerLogs(args: {
    containerId: string;
    stdoutFile?: string;
    stderrFile?: string;
}): Promise<void> {
    const stdoutFile = args.stdoutFile ? await fse.open(args.stdoutFile, "w") : "ignore";
    const stderrFile = args.stderrFile ? await fse.open(args.stderrFile, "w") : "ignore";

    await new Promise<void>((resolve) => {
        childProcess.spawn("sudo", [
            "docker",
            "logs",
            args.containerId,
        ], {
            stdio: ["ignore", stdoutFile, stderrFile],
        }).once('close', resolve);
    });

    if (args.stdoutFile) await fse.close(<number>stdoutFile);
    if (args.stderrFile) await fse.close(<number>stderrFile);
}

export function dockerStop(args: {
    containerId: string;
}): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        childProcess.execFile('sudo', [
            "docker",
            "stop",
            args.containerId,
        ], err => {
            if (err) {
                reject(err);
            }
            resolve();
        });
    });
}

export function dockerRm(args: {
    containerId: string;
}): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        childProcess.execFile('sudo', [
            "docker",
            "rm",
            args.containerId,
        ], err => {
            if (err) {
                reject(err);
            }
            resolve();
        });
    });
}
