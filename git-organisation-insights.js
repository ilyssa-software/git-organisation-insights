// ==UserScript==
// @name         Git Organisation Insights
// @namespace    http://tampermonkey.net/
// @version      0.0.3
// @description  Display organisation-wide goals and issues grouped by repositories via an insight button.
// @author       Baris Sencan (baris@ilyssa.software)
// @match        https://gitlab.com/**
// @grant        GM_xmlhttpRequest
// @require      https://cdn.jsdelivr.net/npm/vue/dist/vue.js
// ==/UserScript==

(function() {
    'use strict';

    // ---- Configuration

    const groupName = 'ilyssa';
    const repoNames = ['website', 'core-react-native', 'core-ios'];

    const componentLabelColor = '#FFECDB'; // Must be upper case. Example components: Profile, Profile > Edit, Messages, ...
    const driverLabelColor = '#8E44AD'; // Must be upper case. Example drivers: Experience, Growth, Monetization, Maintenance, ...
    const goalMilestoneTitlePrefix = 'Goal: '; // Examples: Goal: Group Messaging, Goal: E-Commerce, ...
    const issueDependencyKeyword = 'Dependency'; // Example: (Inside the description of an issue under my-application) Dependency #56
    const sprintLabelTitles = ['Current Sprint', 'Next Sprint', 'Soon', 'Later']; // It's better to have these in different colors.

    // ---- Other Global Variables

    const entryAppElementId = 'gitlab-insights-entry';
    let entryApp = null;

    const mainAppElementId = 'gitlab-insights';
    let mainApp = null;

    // ---- API

    // -- Entry App

    function addEntryApp() {
        if (entryApp) {
            return entryApp;
        }

        const entryAppElement = document.createElement('div');
        entryAppElement.setAttribute('id', entryAppElementId);
        entryAppElement.setAttribute('style', 'margin-top: 3px;');
        entryAppElement.appendChild(createInsightsButton());
        document.getElementsByClassName('title-container')[0].appendChild(entryAppElement);

        return createEntryApp(entryAppElementId);
    }

    function createInsightsButton() {
        const insightsButton = document.createElement('button');
        insightsButton.setAttribute('id', 'insight-button');
        insightsButton.setAttribute('class', 'btn btn-create btn-inverted js-new-board-list');
        insightsButton.setAttribute('v-on:click', 'showInsights');
        insightsButton.innerHTML = 'Show Insights';
        return insightsButton;
    }

    function createEntryApp(elementId) {
        if (entryApp) {
            return entryApp;
        }

        entryApp = new Vue({
            el: `#${elementId}`,
            methods: {
                showInsights,
            },
        });

        return entryApp;
    }

    function showInsights() {
        const isFirstInit = (mainApp === null);
        addMainApp();
        if (isFirstInit) {
            mainApp.populateGoals();
            mainApp.populateTasks();
        }
        setMainAppVisibility(true);
    }

    function hideInsights() {
        setMainAppVisibility(false);
    }

    // -- Main App

    function addMainApp() {
        if (mainApp) {
            return mainApp;
        }

        document.head.innerHTML += generateMainAppStylesheet();

        const mainAppElement = document.createElement('div');
        mainAppElement.setAttribute('id', mainAppElementId);
        mainAppElement.setAttribute('class', 'gi-container');
        mainAppElement.setAttribute('style', generateMainAppElementStyle(true));
        document.body.appendChild(mainAppElement);

        return createMainApp(mainAppElementId);
    }

    function setMainAppVisibility(isVisible) {
        const mainAppElement = document.getElementById(mainAppElementId);

        if (!mainAppElement) return;

        mainAppElement.setAttribute('style', generateMainAppElementStyle(isVisible));
    }

    function generateMainAppElementStyle(isVisible) {
        const display = isVisible ? 'block' : 'none';
        return ` display: ${display}; `;
    }

    function generateMainAppStylesheet() {
        return `
            <style>
                .gi-container {
                    position: fixed;
                    z-index: 1000;
                    left: 0;
                    right: 0;
                    top: 0;
                    bottom: 0;
                    margin: 100px;
                    padding: 10px;
                    background: #fff;
                    border: 3px solid #292961;
                    overflow: scroll;
                }
                button.gi-close {
                    position: fixed;
                    left: 100px;
                    top: 76px;
                    background-color: #fff;
                    color: #db3b21;
                    border-color: #db3b21;
                }
                .gi-important {
                    color: #de7e00;
                    font-weight: bold;
                }
                .gi-goal {
                    text-decoration: none;
                    text-transform: uppercase;
                    font-weight: bold;
                    color: gray;
                    cursor: pointer;
                }
                .gi-separator {
                    font-weight: bolder;
                    font-size: 24px;
                    color: purple;
                }
                table.gi-tasks {
                    width: 100%;
                }
                .gi-task-list {
                    list-style: none;
                    padding: 0;
                }
                .gi-task-assignee {
                    color: gray;
                }
                .gi-task-time-stats {
                    color: green;
                }
                .gi-time-stats-separator {
                    color: lightgreen;
                }
                .gi-done {
                    text-decoration: line-through;
                    text-decoration-color:
                    black;
                }
                a.gi-default {
                    text-decoration: none;
                    color: black;
                }
                a.gi-blend {
                    text-decoration: inherit;
                    color:inherit;
                }
                input[type=radio].gi-default {
                    margin: 0 5px 0 10px;
                }
                select.gi-default {
                    margin-left: 10px;
                }
            </style>
        `;
    }

    function createMainApp(elementId) {
        if (mainApp) {
            return mainApp;
        }

        registerComponentCloseInsights();
        registerComponentSectionGoals();
        registerComponentSectionTasks();

        const mainAppElement = document.getElementById(elementId);
        mainAppElement.innerHTML = `
            <close-insights-button></close-insights-button>
            <section-goals
                v-bind:milestones="milestones"
                v-bind:selected-index="selectedMilestoneIndex"
                v-bind:set-selected-index="setSelectedMilestoneIndex"
            >
            </section-goals>
            <section-tasks
                v-bind:goal-milestone="milestones[selectedMilestoneIndex]"
                v-bind:group-name="groupName"
                v-bind:repo-names="repoNames"
                v-bind:issues-by-repo-name="issuesByRepoName"
                v-bind:sprint-label-titles="sprintLabelTitles"
                v-bind:assignees-by-id="assigneesById"
                v-bind:time-estimates-by-user-id="timeEstimatesByUserId"
                v-bind:time-spent-by-user-id="timeSpentByUserId"
                v-bind:populate-tasks="populateTasks"
            >
            </section-tasks>
        `;

        mainApp = new Vue({
            el: `#${elementId}`,
            data: {
                groupName,
                repoNames,
                milestones: [],
                selectedMilestoneIndex: 0,
                sprintLabelTitles,
                issuesByRepoName: {},
                assigneesById: {},
                timeEstimatesByUserId: {},
                timeSpentByUserId: {},
            },
            methods: {
                setSelectedMilestoneIndex,
                populateGoals,
                populateTasks,
            },
        });

        return mainApp;
    }

    function registerComponentCloseInsights() {
        Vue.component('close-insights-button', {
            methods: {
                hideInsights
            },
            template: `
            <button class="gi-close" v-on:click="hideInsights">
                Close Insights
            </button>
            `
        });
    }

    function registerComponentSectionGoals() {
        Vue.component('section-goals', {
            props: [
                'milestones',
                'selectedIndex',
                'setSelectedIndex',
            ],
            template: `
            <div>
                <h2>Goal Timeline</h2>
                <span v-for="(milestone, index) in milestones">
                    <span class="gi-goal" v-on:click="() => setSelectedIndex(index)">
                        <span v-bind:class="{ 'gi-important': index === selectedIndex }">
                            {{ milestone.title.substr(${goalMilestoneTitlePrefix.length}) }}
                        </span>
                    </span>
                    <span v-if="index < milestones.length - 1" class="gi-separator"> | </span>
                </span>
                <div v-if="milestones.length > selectedIndex">
                    From {{ milestones[selectedIndex].start_date }} to {{ milestones[selectedIndex].due_date }}
                </div>
            </div>
            `
        });
    }

    function registerComponentSectionTasks() {
        registerComponentTaskFilters();
        registerComponentRepoTasksList();

        Vue.component('section-tasks', {
            props: [
                'goalMilestone',
                'groupName',
                'repoNames',
                'issuesByRepoName',
                'sprintLabelTitles',
                'assigneesById',
                'timeEstimatesByUserId',
                'timeSpentByUserId',
                'populateTasks',
            ],
            data: () => ({
                filter: {
                    assigneeId: null,
                }
            }),
            methods: {
                setFilter: function (filterDiff) {
                    this.filter = Object.assign({}, Object.assign(this.filter, filterDiff));
                },
                applyFilter: function (issues) {
                    return issues.filter((issue) => (!this.filter.assigneeId || (issue.assignee && issue.assignee.id === this.filter.assigneeId)));
                }
            },
            template: `
            <div>
                <h2>Tasks</h2>
                <task-filters
                    v-bind:sprint-label-titles="sprintLabelTitles"
                    v-bind:assignees-by-id="assigneesById"
                    v-bind:populate-tasks="populateTasks"
                    v-bind:set-filter="setFilter"
                >
                </task-filters>
                <table class="gi-tasks">
                    <tr>
                        <td style="vertical-align: top;" v-for="repoName in repoNames">
                            <repo-tasks-lists
                                v-bind:goal-milestone="goalMilestone"
                                v-bind:group-name="groupName"
                                v-bind:repo-name="repoName"
                                v-bind:issues="issuesByRepoName[repoName] && applyFilter(issuesByRepoName[repoName])"
                                v-bind:time-estimates-by-user-id="timeEstimatesByUserId"
                                v-bind:time-spent-by-user-id="timeSpentByUserId"
                            >
                            </repo-tasks-lists>
                        </td>
                    </tr>
                </table>
            </div>
            `
        });
    }

    function registerComponentTaskFilters() {
        Vue.component('task-filters', {
            props: [
                'sprintLabelTitles',
                'assigneesById',
                'populateTasks',
                'setFilter',
            ],
            data: () => ({
                selectedSprintIndex: 0,
            }),
            methods: {
                handleSprintChange: function (index) {
                    this.selectedSprintIndex = index;
                    this.populateTasks([sprintLabelTitles[index]]);
                },
            },
            template: `
            <table>
                <tr>
                    <td>
                        <strong>Assignee:</strong>
                    </td>
                    <td>
                        <select class="gi-default">
                            <option
                                v-on:click="() => setFilter({ 'assigneeId': null })"
                            >
                                Any
                            </option>
                            <option
                                v-for="assignee in assigneesById"
                                v-on:click="() => setFilter({ 'assigneeId': assignee.id })"
                            >
                                {{ assignee.name }}
                            </option>
                        </select>
                    </td>
                </tr>
                <tr>
                    <td>
                        <strong>Sprint:</strong>
                    </td>
                    <td>
                        <span v-for="(sprintLabelTitle, index) in sprintLabelTitles">
                            <input
                                class="gi-default"
                                type="radio"
                                name="sprint"
                                v-bind:value="sprintLabelTitle"
                                :checked="(index === selectedSprintIndex)"
                                v-on:click="() => handleSprintChange(index)"
                            />
                            <label>{{ sprintLabelTitle }}</label>
                        </span>
                    </td>
                </tr>
            </table>
            `
        });
    }

    function registerComponentRepoTasksList() {
        Vue.component('repo-tasks-lists', {
            props: [
                'goalMilestone',
                'groupName',
                'repoName',
                'issues',
                'timeEstimatesByUserId',
                'timeSpentByUserId',
            ],
            template: `
            <div>
                <h3>
                    <a
                        class="gi-default"
                        target="_blank"
                        v-bind:href="'https://gitlab.com/' + groupName + '/' + repoName + '/issues'"
                    >
                        {{ repoName }}
                    </a>
                </h3>
                <ul v-if="issues" class="gi-task-list">
                    <li
                        v-for="issue in issues"
                        v-bind:class="{
                            'gi-important': goalMilestone &&
                                            issue.milestone &&
                                            (issue.milestone.title === goalMilestone.title)
                        }"
                    >
                        <span
                            class="gi-task-assignee"
                            v-bind:title="
                                            (issue.assignee &&
                                                (
                                                    'Sprint Time: ' +
                                                    (timeSpentByUserId[issue.assignee.id] || 0) +
                                                    '/' +
                                                    (timeEstimatesByUserId[issue.assignee.id] || 0)
                                                )
                                            ) ||
                                            'No time data'
                                        "
                        >
                            [{{ (issue.assignee && issue.assignee.name) || "Unassigned" }}]
                        </span>
                        <span v-bind:class="{ 'gi-done': issue.state === 'closed' }">
                            <a target="_blank" class="gi-blend" v-bind:href="issue.web_url">
                                {{ issue.title }}
                            </a>
                        </span>
                        <span v-if="issue.time_stats.human_time_estimate" class="gi-task-time-stats">
                            <span v-if="issue.time_stats.human_total_time_spent">
                                <span>{{ issue.time_stats.human_total_time_spent }}</span>
                                <span class="gi-time-stats-separator">/</span>
                            </span>
                            <span>{{ issue.time_stats.human_time_estimate }}</span>
                        </span>
                    </li>
                </ul>
            </div>
            `
        });
    }

    // - App Methods

    function setSelectedMilestoneIndex(index) {
        mainApp.selectedMilestoneIndex = index;
    }

    function populateGoals() {
        fetchMilestones(groupName, milestones => {
            mainApp.milestones = milestones.filter(milestone => milestone.title.startsWith(goalMilestoneTitlePrefix));
        });
    }

    function populateTasks(labelTitles) {
        const handleFetchedIssues = (repoName, issues) => {
            let issuesByRepoName = mainApp.issuesByRepoName;
            let assigneesById = mainApp.assigneesById;
            let timeEstimatesByUserId = mainApp.timeEstimatesByUserId;
            let timeSpentByUserId = mainApp.timeSpentByUserId;

            issuesByRepoName[repoName] = issues;

            for (const issue of issues) {
                if (issue.assignee) {
                    // Make time statistics count only for the main assignee.
                    if (!mainApp.timeEstimatesByUserId[issue.assignee.id]) {
                        mainApp.timeEstimatesByUserId[issue.assignee.id] = 0;
                    }
                    if (!mainApp.timeSpentByUserId[issue.assignee.id]) {
                        mainApp.timeSpentByUserId[issue.assignee.id] = 0;
                    }
                    mainApp.timeEstimatesByUserId[issue.assignee.id] += issue.time_stats.time_estimate / 3600;
                    mainApp.timeSpentByUserId[issue.assignee.id] += issue.time_stats.total_time_spent / 3600;
                }

                for (const assignee of issue.assignees) {
                    if (assigneesById[assignee.id]) continue;
                    assigneesById[assignee.id] = assignee;
                }
            }

            mainApp.issuesByRepoName = Object.assign({}, issuesByRepoName);
            mainApp.assigneesById = Object.assign({}, assigneesById);
            mainApp.timeEstimatesByUserId = Object.assign({}, timeEstimatesByUserId);;
            mainApp.timeSpentByUserId = Object.assign({}, timeSpentByUserId);
        };

        if (!labelTitles) {
            labelTitles = [sprintLabelTitles[0]];
        }

        mainApp.issuesByRepoName = {};
        mainApp.assigneesById = {};
        mainApp.timeEstimatesByUserId = {};
        mainApp.timeSpentByUserId = {};

        for (const repoName of repoNames) {
            fetchIssues(repoName, labelTitles, issues => handleFetchedIssues(repoName, issues));
        }
    }

    // - Fetching

    function fetchMilestones(groupName, completion) {
        const groupId = encodeURIComponent(groupName);
        GM_xmlhttpRequest({
            method: 'GET',
            url: `https://gitlab.com/api/v4/groups/${groupId}/milestones?state=active&per_page=100`,
            onload: response => {
                if (response.status != 200) return;
                const milestones = JSON.parse(response.responseText).sort((a, b) =>
                    new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
                );
                completion(milestones);
            }
        });
    }

    function fetchIssues(repoName, labelTitles, completion, page, previouslyFetchedIssues) {
        const projectId = encodeURIComponent(`${groupName}/${repoName}`);
        const queryPartLabels = labelTitles.map(labelTitle => labelTitle.replace(' ', '+')).join(',');

        let url = `https://gitlab.com/api/v4/projects/${projectId}/issues?scope=all&state=all&per_page=100&labels=${queryPartLabels}`;
        if (typeof page === 'number') {
            url += `&page=${page}`;
        } else {
            page = 1;
            previouslyFetchedIssues = [];
        }

        GM_xmlhttpRequest({
            method: 'GET',
            url,
            onload: response => {
                if (response.status != 200) return;
                const currentlyFetchedIssues = JSON.parse(response.responseText);
                const hasNextPage = response.responseHeaders.includes('rel="next"');
                const issues = previouslyFetchedIssues.concat(currentlyFetchedIssues);
                if (hasNextPage) {
                    fetchIssues(repoName, labelTitles, completion, page + 1, issues);
                } else {
                    completion(issues);
                }
            }
        });
    }

    // ---- Main Logic

    addEntryApp();
})();
