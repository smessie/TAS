# 👜 TAS

TAS - Your Todo App with Solid

## Notes on N3 rules file

To use this todo app with another vocabulary than [cal](http://www.w3.org/2002/12/cal/ical#), a **Notation3 rules file** need to be provided to apply schema alignment tasks.  
These rules should map any vocabulary that the data is written in, to the cal vocabulary that this app understands. 
An example for such a rule could look like the following where the data vocabulary is [ncal](https://www.semanticdesktop.org/ontologies/2007/04/02/ncal/)

```turtle
@prefix cal: <http://www.w3.org/2002/12/cal/ical#>.
@prefix schema: <http://schema.org/>.
@prefix ncal: <https://www.semanticdesktop.org/ontologies/2007/04/02/ncal/>.

{
    ?uri a ncal:Todo.
} => {
    ?uri a cal:Vtodo.
}.

{
    ?uri ncal:summary ?name.
} => {
    ?uri schema:text ?name.
}.
```

Next to the rules file, an **inverted rules file** should also be provided to go back from the [cal](http://www.w3.org/2002/12/cal/ical#) vocabulary back to the data vocabulary to your choice.
This rules file is used to map changes back to the original vocabulary, e.g. when a todo is added or a todo is marked as completed.

**IMPORTANT!** Because marking a todo as completed or no longer completed may imply that both triples should be added and deleted, the inverted rules file uses a basic version of the [Function Ontology (FnO)](https://w3id.org/function/spec) and the policy concept as first described in the [Orchestrator spec](https://mellonscholarlycommunication.github.io/spec-orchestrator/#policy-sec) and [Koreographeye](https://github.com/eyereasoner/Koreografeye) to define which triples should be deleted and which should be added.  
The following two rules must be included in the inverted rules file to make this work:

```turtle
@prefix ex: <http://example.org/> .
@prefix cal: <http://www.w3.org/2002/12/cal/ical#>.
@prefix ncal: <https://www.semanticdesktop.org/ontologies/2007/04/02/ncal/>.
@prefix pol: <https://www.example.org/ns/policy#> .
@prefix fno: <https://w3id.org/function/ontology#> .

{
    ?id ex:event ex:MarkCompleted.
    ?id cal:completed ?completedAt.
} => {
    ex:CompletedPolicy pol:policy ex:Pol .
    ex:Pol
        a fno:Execution ;
        fno:executes ex:updateResource ;
        ex:insertTriples ex:IT ;
        ex:deleteTriples ex:DT ;
        ex:subject ?id .
    ex:IT
         ncal:completed ?completedAt ;
         ncal:todoStatus ncal:completedStatus .
    ex:DT ncal:todoStatus ncal:inProcessStatus .
}.

{
    ?id ex:event ex:MarkNotCompleted.
    ?id cal:completed ?completedAt.
} => {
    ex:NotCompletedPolicy pol:policy ex:Pol .
    ex:Pol
        a fno:Execution ;
        fno:executes ex:updateResource ;
        ex:insertTriples ex:IT ;
        ex:deleteTriples ex:DT ;
        ex:subject ?id .
    ex:DT
         ncal:completed ?completedAt ;
         ncal:todoStatus ncal:completedStatus .
    ex:IT ncal:todoStatus ncal:inProcessStatus .
}.
```
The insertTriples and deleteTriples are used to define which triples should be added and which should be deleted.
These triples may be changed to fit your needs, but the subject of the triples should always be the same as the object of the `ex:insertTriples` and `ex:deleteTriples` triples.

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur) + [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin).

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin) to make the TypeScript language service aware of `.vue` types.

If the standalone TypeScript plugin doesn't feel fast enough to you, Volar has also implemented a [Take Over Mode](https://github.com/johnsoncodehk/volar/discussions/471#discussioncomment-1361669) that is more performant. You can enable it by the following steps:

1. Disable the built-in TypeScript Extension
    1) Run `Extensions: Show Built-in Extensions` from VSCode's command palette
    2) Find `TypeScript and JavaScript Language Features`, right click and select `Disable (Workspace)`
2. Reload the VSCode window by running `Developer: Reload Window` from the command palette.

## Customize configuration

See [Vite Configuration Reference](https://vitejs.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
