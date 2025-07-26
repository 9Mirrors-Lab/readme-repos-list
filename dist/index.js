"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = void 0;
const core_1 = require("@actions/core");
const github_1 = require("@actions/github");
const replace_1 = require("./replace");
const token = (0, core_1.getInput)("token") || process.env.GH_PAT || process.env.GITHUB_TOKEN;
const run = async () => {
    if (!token)
        throw new Error("GitHub token not found");
    const octokit = (0, github_1.getOctokit)(token);
    let [owner, repo] = (process.env.GITHUB_REPOSITORY || "").split("/");
    owner = owner || (0, core_1.getInput)("owner");
    repo = repo || (0, core_1.getInput)("repo");
    if (!owner || !repo)
        throw new Error("Owner or repo not found");
    const size = (0, core_1.getInput)("size") || 50;
    const q = (0, core_1.getInput)("query");
    const max = (0, core_1.getInput)("max") ? parseInt((0, core_1.getInput)("max"), 10) : 100;
    const per_page = Math.min(max, 100);
    const repos = await octokit.rest.search.repos({
        q,
        per_page,
        sort: (0, core_1.getInput)("sort") ||
            "stars",
        order: (0, core_1.getInput)("order") || "desc",
    });
    if (max > 100) {
        const numberOfPagesRequired = Math.min(9, Math.floor(max / 100));
        for await (const page of Array.from(Array(numberOfPagesRequired)).map((_, i) => i + 2)) {
            repos.data.items.push(...(await octokit.rest.search.repos({
                q,
                per_page,
                sort: (0, core_1.getInput)("sort") || "stars",
                order: (0, core_1.getInput)("order") || "desc",
                page,
            })).data.items);
        }
    }
    let md = (0, core_1.getInput)("prefix") ||
        "\n<!-- This list is auto-generated using readme-repos-list -->\n<!-- Do not edit this list manually, your changes will be overwritten -->\n";
    repos.data.items
        .filter((repoItem) => repoItem.full_name !== `${owner}/${repo}`)
        .sort((a, b) => (a.name).localeCompare(b.name))
        .filter((item, index, items) => (0, core_1.getInput)("one-per-owner")
        ? items.map((i) => i.owner.login).indexOf(item.owner.login) === index
        : true)
        .forEach((item) => {
        const gitmcpUrl = `https://gitmcp.io/${item.full_name}`;
        md += `* [${item.name}](${item.html_url}) ([gitmcp.io](${gitmcpUrl}))${item.description ? " - " + item.description : ""}\n\n`;
    });
    if ((0, core_1.getInput)("suffix"))
        md += (0, core_1.getInput)("suffix");
    const path = (0, core_1.getInput)("path") || "README.md";
    const current = await octokit.rest.repos.getContent({ owner, repo, path });
    // Handle the new API response structure
    if (Array.isArray(current.data)) {
        throw new Error("Expected file content, got directory");
    }
    // Check if it's a file with content
    if (current.data.type !== "file" || !current.data.content) {
        throw new Error("Expected file content, got " + current.data.type);
    }
    let contents = Buffer.from(current.data.content, "base64").toString("utf8");
    const start = (0, core_1.getInput)("start") || "<!-- start: readme-repos-list -->";
    const end = (0, core_1.getInput)("end") || "<!-- end: readme-repos-list -->";
    contents = (0, replace_1.replaceContents)(start, end, contents, md);
    if (contents.trim() !== Buffer.from(current.data.content, "base64").toString("utf8").trim())
        await octokit.rest.repos.createOrUpdateFileContents({
            owner,
            repo,
            path,
            sha: current.data.sha,
            content: Buffer.from(contents).toString("base64"),
            message: (0, core_1.getInput)("commit-message") || ":pencil: Update repositories in README [skip ci]",
        });
};
exports.run = run;
(0, exports.run)()
    .then(() => { })
    .catch((error) => {
    console.error("ERROR", error);
    (0, core_1.setFailed)(error.message);
});
//# sourceMappingURL=index.js.map