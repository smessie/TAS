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
            <MDBInput v-model="oidcIssuer" label="OIDC Issuer" type="text" required />
            <small class="text-danger" v-if="authError">{{ authError }}<br /></small>
            <MDBBtn color="primary" @click="login" style="margin-top: 1rem">Login</MDBBtn>
          </div>
        </MDBCardText>
      </MDBCardBody>
    </MDBCard>

    <MDBCard>
      <MDBCardBody class="w-100">
        <MDBCardTitle>Input</MDBCardTitle>
        <MDBCardText>
          <MDBInput label="Dataset URL" type="url" v-model="doc" />
          <small class="text-danger" v-if="docError">{{ docError }}</small>
          <MDBInput label="N3 Conversion Rules URL" type="url" v-model="rules" style="margin-top: 1rem" />
          <small style="margin-bottom: 1rem">Leave this URL empty to not apply any schema alignment tasks.</small>
          <small class="text-danger" v-if="rulesError">{{ rulesError }}</small>
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
            <MDBBtn
              outline="primary"
              id="button-add"
              :ripple="{ color: 'dark' }"
              @click="addTodo"
              :disabled="!newTodo || todos === undefined"
            >
              Add
            </MDBBtn>
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
              :checked="todo.completedAt"
              @change="toggleCompleted($event, todo)"
            />
            {{ todo.name }}
            <MDBRow style="margin-left: 1rem">
              <MDBCol
                ><small v-if="todo.createdAt">Created: {{ $filters.formatDate(todo.createdAt) }}</small></MDBCol
              >
              <MDBCol
                ><small v-if="todo.completedAt">Completed: {{ $filters.formatDate(todo.completedAt) }}</small></MDBCol
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

<script>
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
import { QueryEngine } from "@comunica/query-sparql";
import { v4 as uuidv4 } from "uuid";
import { n3reasoner } from "eyereasoner";

export default {
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
      todos: undefined,
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
      authError: "",
      docError: "",
      rulesError: "",
    };
  },
  created() {
    handleIncomingRedirect({
      restorePreviousSession: true,
    }).then((info) => {
      this.loggedIn = info.webId;
    });
  },
  methods: {
    async addTodo(event) {
      event.preventDefault();

      if (this.newTodo) {
        // Add to-do to Solid document.
        const uuid = uuidv4();
        const date = new Date().toISOString();

        let prefixes = `
        PREFIX cal: <http://www.w3.org/2002/12/cal/ical#>
        PREFIX schema: <http://schema.org/>`;
        let triples = `
        <${this.doc}#${uuid}> a cal:Vtodo ;
            schema:text "${this.newTodo}" ;
            cal:created "${date}" .`;

        if (this.rules) {
          if (!this.invertedRules) {
            this.error = "You need to specify the inverted rules file before you can create a todo.";
            return;
          }

          // Apply schema alignment tasks.
          const options = { blogic: false, outputType: "string" };
          const reasonerResult = await n3reasoner(`${prefixes}\n${triples}`, this.invertedRules, options);
          const splitResult = this.splitReasoningResult(reasonerResult);
          prefixes = splitResult.prefixes;
          triples = splitResult.triples;
        }

        await fetch(this.doc, {
          method: "PATCH",
          headers: {
            "Content-Type": "text/n3",
          },
          body: `
        ${prefixes}
        @prefix solid: <http://www.w3.org/ns/solid/terms#>.
        _:test a solid:InsertDeletePatch;
          solid:inserts {
            ${triples}
          }.
        `,
        });

        // Add to-do to list in app.
        this.todos.push({
          name: this.newTodo,
          createdAt: date,
          uri: `${this.doc}#${uuid}`,
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
        }).catch((e) => {
          this.authError = e.message;
        });
      }
    },
    async logout() {
      await logout();
      this.loggedIn = undefined;
    },
    async execute(event) {
      event.preventDefault();

      // Check if valid URL
      try {
        new URL(this.doc);
      } catch (e) {
        this.docError = "Please enter a valid URL.";
        return;
      }

      let n3doc = await fetch(this.doc, {
        cors: "cors",
      }).then((response) => response.text());

      this.rawOriginal = n3doc;

      if (this.rules) {
        // Check if valid URL
        try {
          new URL(this.rules);
        } catch (e) {
          this.rulesError = "Please enter a valid URL.";
          return;
        }

        // Apply schema alignment tasks.
        const n3rules = await fetch(this.rules, {
          cors: "cors",
        }).then((response) => response.text());

        // Add base to doc if not yet. Fixing relative IRIs.
        if (!n3doc.includes("@base") && !n3doc.includes("BASE")) {
          n3doc = `@base <${this.doc}> .\n${n3doc}`;
        }

        const options = { blogic: false, outputType: "string" };
        n3doc = await n3reasoner(n3doc, n3rules, options);
      }

      this.rawAligned = n3doc;

      // Use document content to parse to to-do objects.
      this.todos = [];
      this.todos = await this.parseTodoDoc(n3doc);
    },
    async parseTodoDoc(doc) {
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
          uri: binding.get("uri").value,
          name: binding.get("name").value,
          createdAt: binding.get("createdAt")?.value,
          completedAt: binding.get("completedAt")?.value,
        };
      });
    },
    async toggleCompleted(event, todo) {
      if (todo.completedAt) {
        // Mark as not completed.
        let prefixes = `BASE <${this.doc}>\nPREFIX cal: <http://www.w3.org/2002/12/cal/ical#>\nPREFIX ex: <http://example.org/>`;
        const triples = `<${todo.uri}> cal:completed "${todo.completedAt}" ; ex:event ex:MarkNotCompleted .`;

        let insertTriples = "";
        let deleteTriples = `<${todo.uri}> cal:completed ?completedAt .`;

        if (this.rules) {
          if (!this.invertedRules) {
            this.error = "You need to specify the inverted rules file before you can toggle a todo.";
            event.target.checked = true;
            return;
          }

          // Apply schema alignment tasks.
          const options = { blogic: false, outputType: "string" };
          const reasonerResult = await n3reasoner(`${prefixes}\n${triples}`, this.invertedRules, options);

          // Parse policy to get insert and delete triples.
          const policy = await this.parseToggleCompletedPolicy(reasonerResult);

          insertTriples = policy.insertTriples
            .map((t) => `${this.objectToString(t.s)} ${this.objectToString(t.p)} ${this.objectToString(t.o)} .`)
            .join("\n");
          deleteTriples = policy.deleteTriples
            .map((t) => `${this.objectToString(t.s)} ${this.objectToString(t.p)} ${this.objectToString(t.o)} .`)
            .join("\n");
        }

        // Update document.
        await this.executePolicy(prefixes, insertTriples, deleteTriples);

        todo.completedAt = undefined;
      } else {
        // Mark as completed.
        const date = new Date().toISOString();

        let prefixes = `BASE <${this.doc}>\nPREFIX cal: <http://www.w3.org/2002/12/cal/ical#>\nPREFIX ex: <http://example.org/>`;
        const triples = `<${todo.uri}> cal:completed "${date}" ; ex:event ex:MarkCompleted .`;

        let insertTriples = `<${todo.uri}> cal:completed "${date}" .`;
        let deleteTriples = "";

        if (this.rules) {
          if (!this.invertedRules) {
            this.error = "You need to specify the inverted rules file before you can toggle a todo.";
            event.target.checked = false;
            return;
          }

          // Apply schema alignment tasks.
          const options = { blogic: false, outputType: "string" };
          const reasonerResult = await n3reasoner(`${prefixes}\n${triples}`, this.invertedRules, options);

          // Parse policy to get insert and delete triples.
          const policy = await this.parseToggleCompletedPolicy(reasonerResult);

          insertTriples = policy.insertTriples
            .map((t) => `${this.objectToString(t.s)} ${this.objectToString(t.p)} ${this.objectToString(t.o)} .`)
            .join("\n");
          deleteTriples = policy.deleteTriples
            .map((t) => `${this.objectToString(t.s)} ${this.objectToString(t.p)} ${this.objectToString(t.o)} .`)
            .join("\n");
        }

        // Update document.
        await this.executePolicy(prefixes, insertTriples, deleteTriples);

        todo.completedAt = date;
      }
    },
    splitReasoningResult(result) {
      return {
        prefixes: result
          .split("\n")
          .filter((line) => line.startsWith("@prefix") || line.startsWith("@base") || line.startsWith("BASE"))
          .join("\n"),
        triples: result
          .split("\n")
          .filter((line) => !line.startsWith("@prefix") || line.startsWith("@base") || line.startsWith("BASE"))
          .join("\n"),
      };
    },
    async loadInvertedRules() {
      this.invertedRules = await fetch(this.invertedRulesUrl, {
        cors: "cors",
      }).then((response) => response.text());

      this.error = "";
    },
    async parseToggleCompletedPolicy(doc) {
      // Add base to doc if not yet. Fixing relative IRIs.
      if (!doc.includes("@base") && !doc.includes("BASE")) {
        doc = `@base <${this.doc}> .\n${doc}`;
      }
      const queryInsertTriples = `
      PREFIX ex: <http://example.org/>
      PREFIX pol: <https://www.example.org/ns/policy#>
      PREFIX fno: <https://w3id.org/function/ontology#>

      SELECT ?s ?p ?o WHERE {
        ?id pol:policy [
          a fno:Execution ;
          fno:executes ex:updateResource ;
          ex:subject ?s ;
          ex:insertTriples [
            ?p ?o
          ]
        ] .
      }
      `;
      const bindingsInsertTriples = await (
        await this.engine.queryBindings(queryInsertTriples, {
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

      // Map to normal objects.
      const insertTriples = bindingsInsertTriples.map((binding) => {
        return {
          s: binding.get("s"),
          p: binding.get("p"),
          o: binding.get("o"),
        };
      });

      const queryDeleteTriples = `
      PREFIX ex: <http://example.org/>
      PREFIX pol: <https://www.example.org/ns/policy#>
      PREFIX fno: <https://w3id.org/function/ontology#>

      SELECT ?s ?p ?o WHERE {
        ?id pol:policy [
          a fno:Execution ;
          fno:executes ex:updateResource ;
          ex:subject ?s ;
          ex:deleteTriples [
            ?p ?o
          ]
        ] .
      }
      `;

      const bindingsDeleteTriples = await (
        await this.engine.queryBindings(queryDeleteTriples, {
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

      // Map to normal objects.
      const deleteTriples = bindingsDeleteTriples.map((binding) => {
        return {
          s: binding.get("s"),
          p: binding.get("p"),
          o: binding.get("o"),
        };
      });

      return {
        insertTriples,
        deleteTriples,
      };
    },
    async executePolicy(prefixes, insertTriples, deleteTriples) {
      let query = `
        ${prefixes}
        @prefix solid: <http://www.w3.org/ns/solid/terms#>.
        _:executePolicy a solid:InsertDeletePatch.`;

      // Delete triples if any.
      if (deleteTriples) {
        query += `
        _:executePolicy solid:deletes {
          ${deleteTriples}
        }.`;
      }

      // Insert triples if any.
      if (insertTriples) {
        query += `
        _:executePolicy solid:inserts {
          ${insertTriples}
        }.`;
      }

      await fetch(this.doc, {
        method: "PATCH",
        headers: {
          "Content-Type": "text/n3",
        },
        body: query,
      });
    },
    objectToString(object) {
      if (object.termType === "NamedNode") {
        return `${this.sparqlEscapeUri(object.value)}`;
      } else if (object.termType === "BlankNode") {
        return `_:${object.value}`;
      } else if (object.termType === "Literal") {
        if ("dataType" in object) {
          return `${this.sparqlEscapeString(object.value)}^^${this.sparqlEscapeUri(object.dataType.value)}`;
        } else if ("datatype" in object) {
          return `${this.sparqlEscapeString(object.value)}^^${this.sparqlEscapeUri(object.datatype.value)}`;
        } else {
          return `${this.sparqlEscapeString(object.value)}`;
        }
      } else {
        throw new Error(`Unknown term type ${object.termType}`);
      }
    },
    sparqlEscapeUri(value) {
      return (
        "<" +
        value.replace(/[\\"<>]/g, function (match) {
          return "\\" + match;
        }) +
        ">"
      );
    },
    sparqlEscapeString(value) {
      return (
        '"""' +
        value.replace(/[\\"]/g, function (match) {
          return "\\" + match;
        }) +
        '"""'
      );
    },
  },
};
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
