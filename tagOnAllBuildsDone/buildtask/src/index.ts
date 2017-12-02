import * as taskLib from "vsts-task-lib/task";
import * as vsts from "vso-node-api";
import { BuildStatus } from "vso-node-api/interfaces/BuildInterfaces";

async function run(): Promise<void> {

  // vsts Task Token
  const token: string | undefined = process.env["TOKEN"] || taskLib.getEndpointAuthorizationParameter('SYSTEMVSSCONNECTION', 'ACCESSTOKEN', false);
  if (!token || token === '') {
    throw new Error(`You need to 'Allow scripts to access OAuth token' in the 'options' tab of your build system.`);
  }

  const project: string | undefined = process.env["SYSTEM_TEAMPROJECT"];
  if (!project) {
    throw new Error(`Could not determine project name. This task may not be compatible with your build system.`);
  }

  const repo: string | undefined = process.env["BUILD_REPOSITORY_NAME"];
  if (!repo) {
    throw new Error(`Could not determine repository name. This task may not be compatible with your build system.`);
  }

  const currentBuildSourceBranch: string | undefined = process.env["BUILD_SOURCEBRANCH"];
  if (!currentBuildSourceBranch) {
    throw new Error(`Could not determine the current Build Source Branch. This task may not be compatible with your build system.`);
  }

  const currentBuildSourceVersion: string | undefined = process.env["BUILD_SOURCEVERSION"];
  if (!currentBuildSourceVersion) {
    throw new Error(`Could not determine the current Build Source Version. This task may not be compatible with your build system.`);
  }

  const endpointAndCollection: string | undefined = process.env["SYSTEM_TEAMFOUNDATIONCOLLECTIONURI"];
  if (!endpointAndCollection) {
    throw new Error(`Could not determine build server uri. This task may not be compatible with your build system.`);
  }

  const authHandler = vsts.getPersonalAccessTokenHandler(token);
  const vstsApi = new vsts.WebApi(endpointAndCollection, authHandler);

  const buildsInProgressOrQueued = await vstsApi.getBuildApi().getBuilds(
    project,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    BuildStatus.InProgress | BuildStatus.NotStarted);

  const buildWithSameBranchAndSource = buildsInProgressOrQueued
    .filter(c =>
      c.sourceBranch === currentBuildSourceBranch &&
      c.sourceVersion === currentBuildSourceVersion
    );

  // console.log('buildWithSameBranchAndSource', buildWithSameBranchAndSource);

  if (buildWithSameBranchAndSource.length === 0) {
    taskLib.error('No build found! We should see at least the current build! Please contact the dev.');
  } else if (buildWithSameBranchAndSource.length === 1) {
    taskLib.debug(`Let's tag the current build`);
    taskLib.debug(`No other build running on the same source ('${currentBuildSourceBranch}' & '${currentBuildSourceVersion}')`);
    await vstsApi.getBuildApi().addBuildTags(['allBuildsDone'], project, buildWithSameBranchAndSource[0].id);
    taskLib.debug(`Tag: 'allBuildsDone' added to the build ${buildWithSameBranchAndSource[0].id}`);    
  } else {
    taskLib.warning(`Still ${buildWithSameBranchAndSource.length - 1} other build running on '${currentBuildSourceBranch}'`)
  }

  // the end!
  taskLib.debug(`Done`);
}

run()
  .then(() =>
    taskLib.setResult(taskLib.TaskResult.Succeeded, "")
  )
  .catch((err) =>
    taskLib.setResult(taskLib.TaskResult.Failed, err)
  );