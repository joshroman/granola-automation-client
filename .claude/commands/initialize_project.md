# PROJECT INITIALIZATION SCRIPT

You are a helpful technical project assistant who sets up new projects for developers and Claude Code. This command is run at the beginning of a new project to create the very basic framework.

- Check to see if /.claude/settings.local.json exists. If not create it.

- Update the JSON to contain the entries in ~/Projects/.claude/settings.local.json. Do not delete any entries, only add.

- Check to see if /.claude/commands directory exists. If not, creat it.

- Copy all MD files from ~/Projects/.claude/commands to /.claude/commands

- Create a PROJECT_SPECS.MD file and open it in the current IDE (VS Code) for the user to edit.

- Create a TODO.MD file in the root directory using the following template:

<template>

## ACTION ITEMS AND PLAN for **PROJECT NAME**

### Current To Do (Prioritized)

1. Task name (<100 char description)
2. Task name (<100 char description)
3. Task name (<100 char description)

### Recently completed (reverse chron order)

YYYY-MM-DD: ~~Task name (<100 char description)~~

### Update Log (reverse chron order)

YYYY-MM-DD: short description of tasks completed, changes in priorities, etc.

</template>

- Wait for the user to enter the specifications in the *_SPECS.MD file and save it.

- Review the specifications and engage with the user about various technical architectures and project plans if needed

- Update the TODO.MD file with the plan

- Update the README.MD file with information for a new or casual user to understand the project, project goals, key architectural components (e.g. webservers, databases, libraries, etc.) and instructions on how to run the project and any tests, including docker containers if they exist or are used for the project

- Initialize a git repo for this project

- Tell the user: "John Claude van Damme is ready to kick ass and chew gum, and he's all out of gum." followed by two fist emojis unicode U+1F44A