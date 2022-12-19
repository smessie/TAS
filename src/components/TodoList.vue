<template>
  <MDBContainer>
    <h1>👜 TAS - your Todo App with Solid</h1>

    <MDBCard>
      <MDBCardBody class="w-100">
        <MDBCardTitle>Authentication</MDBCardTitle>
        <MDBCardText>
          <div v-if="loggedIn">
            <p class="text-success">
              You are logged in as <em>{{ loggedIn }}</em
              >.
            </p>
            <MDBBtn color="primary" @click="logout">Logout</MDBBtn>
          </div>
          <div v-else>
            <MDBInput v-model="oidcIssuer" label="OIDC Issuer" type="text" required style="margin-bottom: 1rem" />
            <MDBBtn color="primary" @click="login">Login</MDBBtn>
          </div>
        </MDBCardText>
      </MDBCardBody>
    </MDBCard>

    <MDBCard>
      <MDBCardBody class="w-100">
        <MDBCardTitle>Input</MDBCardTitle>
        <MDBCardText>
          <MDBInput label="Dataset URL" type="url" v-model="doc" style="margin-bottom: 1rem" />
          <MDBInput label="N3 Conversion Rules URL" type="url" v-model="rules" />
          <small style="margin-bottom: 1rem">Leave this URL empty to not apply any schema alignment tasks.</small>
        </MDBCardText>

        <MDBBtn color="primary" @click="execute" id="execute-btn">Load</MDBBtn>
      </MDBCardBody>
    </MDBCard>

    <MDBCard v-if="rules">
      <MDBCardBody class="w-100">
        <MDBCardTitle>Output</MDBCardTitle>
        <MDBCardText>
          <MDBInput label="N3 Conversion Rules URL" type="url" v-model="invertedRulesUrl" @change="loadInvertedRules" />
          <small style="margin-bottom: 1rem">Rules to convert changes back to the original ontology.</small>
        </MDBCardText>
      </MDBCardBody>
    </MDBCard>

    <MDBSwitch v-model="rawView" label="Raw view" labelColor="primary"></MDBSwitch>

    <MDBCard v-if="!rawView">
      <MDBCardBody class="w-100">
        <p class="text-danger" v-if="error">{{ error }}</p>

        <form @submit="addTodo">
          <MDBInput
            inputGroup
            :formOutline="false"
            wrapperClass="mb-3"
            v-model="newTodo"
            placeholder="Write your new todo here"
            aria-label="Write your new todo here"
            aria-describedby="button-add"
            style="margin-left: 3rem"
          >
            <MDBBtn outline="primary" id="button-add" :ripple="{ color: 'dark' }" @click="addTodo"> Add </MDBBtn>
          </MDBInput>
        </form>

        <MDBListGroup light>
          <MDBListGroupItem
            v-for="(todo, index) in todos"
            :key="index"
            tag="label"
            action
            class="override-padding-left"
          >
            <input
              class="form-check-input me-1"
              type="checkbox"
              :checked="todo.completedAt !== undefined"
              @change="toggleCompleted($event, todo)"
            />
            {{ todo.name }}
            <MDBRow style="margin-left: 1rem">
              <MDBCol
                ><small v-if="todo.createdAt">Created: {{ formatDate(todo.createdAt) }}</small></MDBCol
              >
              <MDBCol
                ><small v-if="todo.completedAt">Completed: {{ formatDate(todo.completedAt) }}</small></MDBCol
              >
            </MDBRow>
          </MDBListGroupItem>
        </MDBListGroup>
      </MDBCardBody>
    </MDBCard>

    <MDBCard v-if="rawView">
      <MDBCardBody class="w-100">
        <pre>{{ rawOriginal }}</pre>
        <hr />
        <pre>{{ rawAligned }}</pre>
      </MDBCardBody>
    </MDBCard>
  </MDBContainer>
</template>

<script lang="ts">
import {
  MDBContainer,
  MDBListGroup,
  MDBListGroupItem,
  MDBInput,
  MDBBtn,
  MDBCard,
  MDBCardBody,
  MDBCardText,
  MDBCardTitle,
  MDBRow,
  MDBCol,
  MDBSwitch,
} from "mdb-vue-ui-kit";
import { getDefaultSession, handleIncomingRedirect, login, fetch, logout } from "@inrupt/solid-client-authn-browser";
import { QueryEngine } from "@comunica/query-sparql-solid";
import { v4 as uuidv4 } from "uuid";
import { n3reasoner } from "eye-mock";
import { defineComponent } from "vue";
import moment from "moment/moment";

type Todo = {
  name: string | undefined;
  createdAt: string | undefined;
  completedAt: string | undefined;
  uri: string | undefined;
};

type MyData = {
  newTodo: string;
  todos: Todo[];
  loggedIn: string | undefined;
  oidcIssuer: string;
  doc: string;
  engine: QueryEngine;
  rules: string;
  invertedRulesUrl: string;
  invertedRules: string;
  rawView: boolean;
  rawOriginal: string;
  rawAligned: string;
  error: string;
};

export default defineComponent({
  name: "TodoList",
  components: {
    MDBContainer,
    MDBListGroup,
    MDBListGroupItem,
    MDBInput,
    MDBBtn,
    MDBCard,
    MDBCardBody,
    MDBCardTitle,
    MDBCardText,
    MDBRow,
    MDBCol,
    MDBSwitch,
  },
  data() {
    return {
      newTodo: "",
      todos: [],
      loggedIn: undefined,
      oidcIssuer: "",
      doc: "",
      engine: new QueryEngine(),
      rules: "",
      invertedRulesUrl: "",
      invertedRules: "",
      rawView: false,
      rawOriginal: "",
      rawAligned: "",
      error: "",
    } as MyData;
  },
  created() {
    handleIncomingRedirect({
      restorePreviousSession: true,
    }).then((info) => {
      this.loggedIn = info?.webId;
    });
  },
  methods: {
    async addTodo(event: any) {
      event.preventDefault();

      if (this.newTodo) {
        // Add to-do to Solid document.
        const uuid = uuidv4();
        const date = new Date().toISOString();

        let prefixes = `
        PREFIX cal: <http://www.w3.org/2002/12/cal/ical#>
        PREFIX schema: <http://schema.org/>`;
        let triples = `
        <#${uuid}> a cal:Vtodo ;
            schema:text "${this.newTodo}" ;
            cal:created "${date}" .`;

        if (this.rules) {
          if (!this.invertedRules) {
            this.error = "You need to specify the inverted rules file before you can create a todo.";
            return;
          }

          // Apply schema alignment tasks.
          const reasonerResult = await n3reasoner(`${prefixes}\n${triples}`, this.invertedRules, true);
          const splitResult = this.splitReasoningResult(reasonerResult);
          prefixes = splitResult.prefixes;
          triples = splitResult.triples;
        }

        const query = `
        ${prefixes.replaceAll("@prefix", "PREFIX").replace(/>[ \t\s]*\.[ \t\s]*/g, ">")}
        INSERT DATA {
          ${triples}
        }`;

        await this.engine.queryVoid(query, {
          sources: [this.doc],
          destination: { type: "patchSparqlUpdate", value: this.doc },
          "@comunica/actor-http-inrupt-solid-client-authn:session": getDefaultSession(),
          baseIRI: this.doc,
        });

        // Add to-do to list in app.
        this.todos.push({
          name: this.newTodo,
          createdAt: date,
          uri: `${this.doc}#${uuid}`,
          completedAt: undefined,
        });
        this.newTodo = "";
      }
    },
    async login() {
      await handleIncomingRedirect();

      // 2. Start the Login Process if not already logged in.
      if (!getDefaultSession().info.isLoggedIn) {
        await login({
          // Specify the URL of the user's Solid Identity Provider;
          // e.g., "https://login.inrupt.com".
          oidcIssuer: this.oidcIssuer,
          // Specify the URL the Solid Identity Provider should redirect the user once logged in,
          // e.g., the current page for a single-page app.
          redirectUrl: window.location.href,
          // Provide a name for the application when sending to the Solid Identity Provider
          clientName: "TAS",
        });
      }
    },
    async logout() {
      await logout();
      this.loggedIn = undefined;
    },
    async execute(event: any) {
      event.preventDefault();

      let n3doc = await fetch(this.doc, {
        mode: "cors",
      }).then((response) => response.text());

      this.rawOriginal = n3doc;

      if (this.rules) {
        // Apply schema alignment tasks.
        const n3rules = await fetch(this.rules, {
          mode: "cors",
        }).then((response) => response.text());

        n3doc = await n3reasoner(n3doc, n3rules, true);
      }

      this.rawAligned = n3doc;

      // Use document content to parse to to-do objects.
      this.todos = [];
      this.todos = await this.parseTodoDoc(n3doc);
    },
    async parseTodoDoc(doc: string): Promise<Todo[]> {
      console.log(doc);

      const query = `
      PREFIX cal: <http://www.w3.org/2002/12/cal/ical#>
      PREFIX schema: <http://schema.org/>

      SELECT ?uri ?name ?createdAt ?completedAt WHERE {
        ?uri a cal:Vtodo;
            schema:text ?name.
        OPTIONAL { ?uri cal:created ?createdAt }.
        OPTIONAL { ?uri cal:completed ?completedAt }.
      }
      `;
      const bindings = await (
        await this.engine.queryBindings(query, {
          sources: [
            {
              type: "stringSource",
              value: doc,
              mediaType: "text/n3",
              baseIRI: this.doc,
            },
          ],
        })
      ).toArray();

      console.log(bindings);

      // Map to normal objects.
      return bindings.map((binding) => {
        return {
          uri: binding.get("uri")?.value,
          name: binding.get("name")?.value,
          createdAt: binding.get("createdAt")?.value,
          completedAt: binding.get("completedAt")?.value,
        };
      });
    },
    async toggleCompleted(event: any, todo: Todo) {
      if (todo.completedAt) {
        // Mark as not completed.
        let prefixes = "PREFIX cal: <http://www.w3.org/2002/12/cal/ical#>";
        let triples = `<${todo.uri}> cal:completed "${todo.completedAt}" .`;

        if (this.rules) {
          if (!this.invertedRules) {
            this.error = "You need to specify the inverted rules file before you can toggle a todo.";
            event.target.checked = true;
            return;
          }

          // Apply schema alignment tasks.
          const reasonerResult = await n3reasoner(`${prefixes}\n${triples}`, this.invertedRules, true);
          const splitResult = this.splitReasoningResult(reasonerResult);
          prefixes = splitResult.prefixes;
          triples = splitResult.triples;
        }

        const query = `
        ${prefixes.replaceAll("@prefix", "PREFIX").replace(/>[ \t\s]*\.[ \t\s]*/g, ">")}
        DELETE DATA {
          ${triples}
        }`;

        await this.engine.queryVoid(query, {
          sources: [this.doc],
          destination: { type: "patchSparqlUpdate", value: this.doc },
          "@comunica/actor-http-inrupt-solid-client-authn:session": getDefaultSession(),
          baseIRI: this.doc,
        });

        todo.completedAt = undefined;
      } else {
        // Mark as completed.
        const date = new Date().toISOString();

        let prefixes = "PREFIX cal: <http://www.w3.org/2002/12/cal/ical#>";
        let triples = `<${todo.uri}> cal:completed "${date}" .`;

        if (this.rules) {
          if (!this.invertedRules) {
            this.error = "You need to specify the inverted rules file before you can toggle a todo.";
            event.target.checked = false;
            return;
          }

          // Apply schema alignment tasks.
          const reasonerResult = await n3reasoner(`${prefixes}\n${triples}`, this.invertedRules, true);
          const splitResult = this.splitReasoningResult(reasonerResult);
          prefixes = splitResult.prefixes;
          triples = splitResult.triples;
        }

        const query = `
        ${prefixes.replaceAll("@prefix", "PREFIX").replace(/>[ \t\s]*\.[ \t\s]*/g, ">")}
        INSERT DATA {
          ${triples}
        }`;

        await this.engine.queryVoid(query, {
          sources: [this.doc],
          destination: { type: "patchSparqlUpdate", value: this.doc },
          "@comunica/actor-http-inrupt-solid-client-authn:session": getDefaultSession(),
          baseIRI: this.doc,
        });

        todo.completedAt = date;
      }
    },
    splitReasoningResult(result: string): { prefixes: string; triples: string } {
      return {
        prefixes: result
          .split("\n")
          .filter((line) => line.startsWith("@prefix"))
          .join("\n"),
        triples: result
          .split("\n")
          .filter((line) => !line.startsWith("@prefix"))
          .join("\n"),
      };
    },
    async loadInvertedRules() {
      this.invertedRules = await fetch(this.invertedRulesUrl, {
        mode: "cors",
      }).then((response) => response.text());

      this.error = "";
    },
    formatDate(value: string): string {
      return moment(String(value)).format("MM/DD/YYYY HH:mm");
    },
  },
});
</script>

<style scoped>
.override-padding-left {
  padding-left: 1.5rem;
}
h1 {
  margin-top: 3rem;
  margin-bottom: 3rem;
}
.card {
  margin-bottom: 2rem;
}
</style>
