/*
Copyright 2025 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import * as path from "path";
import * as os from "os";
import * as fse from "fs-extra";

import {dockerRun, dockerStop } from "../docker";

// A plugin that adds command to start & stop dex instances

interface DexConfig {
    configDir: string;
    baseUrl: string;
    port: number;
    host: string;
}

export interface DexInstance extends DexConfig {
    dexId: string;
}

const dexConfigs = new Map<string, DexInstance>();

async function produceConfigWithSynapseURLAdded(): Promise<DexConfig> {
    const templateDir = path.join(__dirname, "template");

    const stats = await fse.stat(templateDir);
    if (!stats?.isDirectory) {
        throw new Error(`Template directory at ${templateDir} not found!`);
    }
    const tempDir = await fse.mkdtemp(path.join(os.tmpdir(), 'hydrogen-testing-dex-'));

    // copy the contents of the template dir, omitting config.yaml as we'll template that
    console.log(`Copy ${templateDir} -> ${tempDir}`);
    await fse.copy(templateDir, tempDir, { filter: f => path.basename(f) !== 'config.yaml' });

    // now copy config.yaml, applying substitutions
    console.log(`Gen ${path.join(templateDir, "config.yaml")}`);
    let hsYaml = await fse.readFile(path.join(templateDir, "config.yaml"), "utf8");
    const synapseHost = process.env.SYNAPSE_IP_ADDRESS;
    const synapsePort = process.env.SYNAPSE_PORT;
    const synapseAddress = `${synapseHost}:${synapsePort}`;
    hsYaml = hsYaml.replace(/{{SYNAPSE_ADDRESS}}/g, synapseAddress);
    const dexHost = process.env.DEX_IP_ADDRESS!;
    const dexPort = parseInt(process.env.DEX_PORT!, 10);
    const dexAddress = `${dexHost}:${dexPort}`;
    hsYaml = hsYaml.replace(/{{DEX_ADDRESS}}/g, dexAddress);
    await fse.writeFile(path.join(tempDir, "config.yaml"), hsYaml);

    const baseUrl = `http://${dexHost}:${dexPort}`;
    return {
        host: dexHost,
        port: dexPort,
        baseUrl,
        configDir: tempDir,
    };
}

export async function dexStart(): Promise<DexInstance> {
    const dexCfg = await produceConfigWithSynapseURLAdded();
    console.log(`Starting dex with config dir ${dexCfg.configDir}...`);
    const dexId = await dockerRun({
        image: "bitnami/dex:latest",
        containerName: "hydrogen-dex",
        dockerParams: [
            "--rm",
            "-v", `${dexCfg.configDir}:/data`,
            `--ip=${dexCfg.host}`,
            "-p", `${dexCfg.port}:5556/tcp`,
            "--network=hydrogen"
        ],
        applicationParams: [
            "serve",
            "data/config.yaml",
        ]
    });

    console.log(`Started dex with id ${dexId} on port ${dexCfg.port}.`);

    const dex: DexInstance = { dexId, ...dexCfg };
    dexConfigs.set(dexId, dex);
    return dex;
}

export async function dexStop(id: string): Promise<void> {
    const dexCfg = dexConfigs.get(id);
    if (!dexCfg) throw new Error("Unknown dex ID");
    await dockerStop({ containerId: id, });
    await fse.remove(dexCfg.configDir);
    dexConfigs.delete(id);
    console.log(`Stopped dex id ${id}.`);
}
