// ==UserScript==
// @name         Git Organisation Insights
// @namespace    http://tampermonkey.net/
// @version      0.0.2
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
        const mainApp = addMainApp();
        mainApp.populateGoals();
        mainApp.populateTasks();
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
        return '<style>' +
            '.gi-container { position: fixed; z-index: 1000; left: 0; right: 0; top: 0; bottom: 0; margin: 100px; padding: 10px; background: #fff; border: 3px solid #292961; overflow: scroll }' +
            'button.gi-close { position: fixed; left: 100px; top: 76px; background-color: #fff; color: #db3b21; border-color: #db3b21 }' +
            '.gi-important { color: #de7e00; font-weight: bold }' +
            '.gi-goal { text-decoration: none; text-transform: uppercase; font-weight: bold; color: gray; cursor: pointer }' +
            '.gi-separator { font-weight: bolder; font-size: 24px; color: purple }' +
            'table.gi-tasks { width: 100% }' +
            '.gi-task-assignee { color: gray }' +
            '.gi-done { text-decoration: line-through; text-decoration-color: black; }' +
            'a.gi-default { text-decoration: none; color: black }' +
            'a.gi-blend { text-decoration: inherit; color:inherit }' +
            'input[type=radio].gi-default { margin: 0 5px 0 10px; }' +
            '</style>';
    }

    function createMainApp(elementId) {
        if (mainApp) {
            return mainApp;
        }

        registerComponentCloseInsights();
        registerComponentSectionGoals();
        registerComponentSectionTasks();

        const mainAppElement = document.getElementById(elementId);
        mainAppElement.innerHTML = '<close-insights-button></close-insights-button>' +
            '<section-goals v-bind:milestones="milestones" v-bind:selected-index="selectedMilestoneIndex" v-bind:set-selected-index="setSelectedMilestoneIndex"></section-goals>' +
            '<section-tasks v-bind:goal-milestone="milestones[selectedMilestoneIndex]" v-bind:group-name="groupName" v-bind:repo-names="repoNames" v-bind:issues-by-repo-name="issuesByRepoName" v-bind:sprint-label-titles="sprintLabelTitles" v-bind:populate-tasks="populateTasks"></section-tasks>';

        mainApp = new Vue({
            el: `#${elementId}`,
            data: {
                groupName,
                repoNames,
                milestones: [],
                selectedMilestoneIndex: 0,
                sprintLabelTitles,
                issuesByRepoName: {},
                queryCategory: '', // '' | 'goal' | 'task'
                query: '',
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
            template: '<button class="gi-close" v-on:click="hideInsights">Close Insights</button>'
        });
    }

    function registerComponentSectionGoals() {
        Vue.component('section-goals', {
            props: ['milestones', 'selectedIndex', 'setSelectedIndex'],
            template: '<div>' +
            '<h2>Goal Timeline</h2>' +
            '<span v-for="(milestone, index) in milestones">' +
            '<span class="gi-goal" v-on:click="() => setSelectedIndex(index)">' +
            `<span v-bind:class="{ \'gi-important\': index === selectedIndex }">{{ milestone.title.substr(${goalMilestoneTitlePrefix.length}) }}</span>` +
            '</span>' +
            '<span v-if="index < milestones.length - 1" class="gi-separator"> | </span>' +
            '</span>' +
            '<div v-if="milestones.length > selectedIndex">{{ milestones[selectedIndex].range }}</div>' +
            '</div>'
        });
    }

    function registerComponentSectionTasks() {
        registerComponentTaskFilters();
        registerComponentRepoTasksTree();

        Vue.component('section-tasks', {
            props: ['goalMilestone', 'groupName', 'repoNames', 'issuesByRepoName', 'sprintLabelTitles', 'populateTasks'],
            template: '<div>' +
            '<h2>Tasks</h2>' +
            '<task-filters v-bind:sprint-label-titles="sprintLabelTitles" v-bind:populate-tasks="populateTasks"></task-filters>' +
            '<table class="gi-tasks"><tr>' +
            '<td style="vertical-align: top;" v-for="repoName in repoNames">' +
            '<repo-tasks-tree v-bind:goal-milestone="goalMilestone" v-bind:group-name="groupName" v-bind:repo-name="repoName" v-bind:issues="issuesByRepoName[repoName]"></repo-tasks-tree>' +
            '</td></tr></table></div>'
        });
    }

    function registerComponentTaskFilters() {
        Vue.component('task-filters', {
            props: ['sprintLabelTitles', 'populateTasks'],
            data: () => ({
                selectedSprintIndex: 0,
            }),
            methods: {
                handleChange: function (index) {
                    this.selectedSprintIndex = index;
                    this.populateTasks([sprintLabelTitles[index]]);
                },
            },
            template: '<div>' +
            '<span v-for="(sprintLabelTitle, index) in sprintLabelTitles">' +
            '<input class="gi-default" type="radio" name="sprint" v-bind:value="sprintLabelTitle" :checked="(index === selectedSprintIndex)" v-on:click="() => handleChange(index)" />' +
            '<label>{{ sprintLabelTitle }}</label>' +
            '</span></div>'
        });
    }

    function registerComponentRepoTasksTree() {
        Vue.component('repo-tasks-tree', {
            props: ['goalMilestone', 'groupName', 'repoName', 'issues'],
            template: '<div>' +
            '<h3><a class="gi-default" target="_blank" v-bind:href="\'https://gitlab.com/\' + groupName + \'/\' + repoName + \'/issues\'">{{ repoName }}</a></h3>' +
            '<ul>' +
            '<li v-for="issue in issues" v-bind:class="{ \'gi-done\': issue.isClosed, \'gi-important\': goalMilestone && (issue.milestoneTitle === goalMilestone.title) }">' +
            '<span class="gi-task-assignee">[{{ issue.assignee.name }}]</span> <a target="_blank" class="gi-blend" v-bind:href="issue.url">{{ issue.title }}</a>' +
            '</li></ul></div>'
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
            issuesByRepoName[repoName] = issues;
            mainApp.issuesByRepoName = Object.assign({}, issuesByRepoName);
        };

        if (!labelTitles) {
            labelTitles = [sprintLabelTitles[0]];
        }

        for (const repoName of repoNames) {
            fetchIssues(repoName, labelTitles, issues => handleFetchedIssues(repoName, issues));
        }
    }

    // - Fetching

    function fetchMilestones(groupName, completion) {
        const groupNameEncoded = encodeURI(groupName);
        GM_xmlhttpRequest({
            method: 'GET',
            url: `https://gitlab.com/groups/${groupNameEncoded}/-/milestones`,
            onload: response => {
                const milestones = parseMilestonesResponseText(response.responseText);
                completion(milestones);
            }
        });
    }

    function fetchIssues(repoName, labelTitles, completion) {
        const groupNameEncoded = encodeURI(groupName);
        const repoNameEncoded = encodeURI(repoName);
        const labelTitlesQueryPart = labelTitles.map(labelTitle => `label_name[]=${encodeURI(labelTitle)}`).join('&');
        GM_xmlhttpRequest({
            method: 'GET',
            url: `https://gitlab.com/${groupNameEncoded}/${repoNameEncoded}/issues?scope=all&utf8=%E2%9C%93&state=all&${labelTitlesQueryPart}`,
            onload: response => {
                const issues = parseIssuesResponseText(response.responseText);
                completion(issues);
            }
        });
    }

    // - Parsing

    function parseMilestonesResponseText(responseText) {
        const rootElement = document.createElement('html');
        rootElement.innerHTML = responseText;

        const milestoneElements = Array.from(rootElement.getElementsByClassName('milestone-open'));

        return milestoneElements.map(milestoneElement => parseMilestoneElement(milestoneElement));
    }

    function parseMilestoneElement(milestoneElement) {
        const milestoneRangeElement = milestoneElement.getElementsByClassName('milestone-range')[0];
        return {
            title: milestoneElement.getElementsByClassName('append-bottom-5')[0].children[0].children[0].textContent,
            url: milestoneElement.getElementsByClassName('append-bottom-5')[0].children[0].children[0].getAttribute('href'),
            range: milestoneRangeElement && milestoneRangeElement.textContent,
        };
    }

    function parseIssuesResponseText(responseText) {
        const rootElement = document.createElement('html');
        rootElement.innerHTML = responseText;

        const issueElements = Array.from(rootElement.getElementsByClassName('issuable-info-container'));

        return issueElements.map(issueElement => parseIssueElement(issueElement));
    }

    function parseIssueElement(issueElement) {
        const milestoneElement = issueElement.getElementsByClassName('issuable-milestone')[0];
        const issueTitleTextElement = issueElement.getElementsByClassName('issue-title-text')[0];
        return {
            reference: issueElement.getElementsByClassName('issuable-reference')[0].textContent.trim(),
            url: issueTitleTextElement.getElementsByTagName('a')[0].getAttribute('href'),
            title: issueTitleTextElement.children[issueTitleTextElement.children.length - 1].textContent.trim(),
            author: issueElement.getElementsByClassName('author')[0].textContent.trim(),
            assignee: parseAuthorLinkElement(issueElement.getElementsByClassName('author-link')[1]),
            labels: Array.from(issueElement.getElementsByClassName('label-link')).map(element => parseLabelLinkElement(element)),
            milestoneTitle: milestoneElement && milestoneElement.children[0].textContent.trim(),
            isClosed: issueElement.innerHTML.includes('CLOSED')
        };
    }

    function parseAuthorLinkElement(authorLinkElement) {
        if (!authorLinkElement) {
            return {
                name: 'Unassigned',
                username: 'unassigned',
                url: null,
            };
        }
        const linkTitle = authorLinkElement.getAttribute('title');
        const linkHref = authorLinkElement.getAttribute('href');
        return {
            name: /.*to\s*(.*)/g.exec(linkTitle)[1],
            username: linkHref.substr(1),
            url: linkHref
        };
    }

    function parseLabelLinkElement(labelLinkElement) {
        return {
            title: labelLinkElement.children[0].textContent.trim(),
            color: /.*background-color:\s*(.*);.*/g.exec(labelLinkElement.children[0].getAttribute('style'))[1],
            url: labelLinkElement.getAttribute('href')
        };
    }

    // ---- Main Logic

    addEntryApp();
})();
