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
            <MDBInput
              v-model="oidcIssuer"
              label="OIDC Issuer"
              type="text"
              required
              style="margin-bottom: 1rem"
            />
            <MDBBtn color="primary" @click="login">Login</MDBBtn>
          </div>
        </MDBCardText>
      </MDBCardBody>
    </MDBCard>

    <MDBCard>
      <MDBCardBody class="w-100">
        <MDBCardTitle>Document</MDBCardTitle>
        <MDBCardText>
          <MDBInput
            label="Dataset URL"
            type="url"
            v-model="doc"
            style="margin-bottom: 1rem"
          />
        </MDBCardText>

        <MDBBtn color="primary" @click="execute" id="execute-btn">Load</MDBBtn>
      </MDBCardBody>
    </MDBCard>

    <MDBCard>
      <MDBCardBody class="w-100">
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
              :checked="todo.get('completedAt')"
            />
            {{ todo.get("name").value }}
            <MDBRow style="margin-left: 1rem">
              <MDBCol
                ><small v-if="todo.get('createdAt')"
                  >Created:
                  {{ $filters.formatDate(todo.get("createdAt").value) }}</small
                ></MDBCol
              >
              <MDBCol
                ><small v-if="todo.get('completedAt')"
                  >Completed:
                  {{
                    $filters.formatDate(todo.get("completedAt").value)
                  }}</small
                ></MDBCol
              >
            </MDBRow>
          </MDBListGroupItem>
        </MDBListGroup>
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
} from "mdb-vue-ui-kit";
import {
  getDefaultSession,
  handleIncomingRedirect,
  login,
  fetch,
  logout,
} from "@inrupt/solid-client-authn-browser";
import { QueryEngine } from "@comunica/query-sparql-solid";
import { v4 as uuidv4 } from "uuid";

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
  },
  data() {
    return {
      newTodo: "",
      todos: [],
      loggedIn: undefined,
      oidcIssuer: "",
      doc: "",
      engine: new QueryEngine(),
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
        const query = `
        PREFIX cal: <http://www.w3.org/2002/12/cal/ical#>
        PREFIX schema: <http://schema.org/>

        INSERT DATA {
          <#${uuid}> a cal:Vtodo ;
            schema:text "${this.newTodo}" ;
            cal:created "${date}" .
        }`;

        await this.engine.queryVoid(query, {
          sources: [this.doc],
          destination: { type: "patchSparqlUpdate", value: this.doc },
          "@comunica/actor-http-inrupt-solid-client-authn:session":
            getDefaultSession(),
          baseIRI: this.doc,
        });

        // Add to-do to list in app.
        this.todos.push({ name: this.newTodo, createdAt: date });
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
    async execute(event) {
      event.preventDefault();

      const n3doc = await fetch(this.doc, {
        cors: "cors",
      }).then((response) => response.text());

      // Use document content to parse to to-do objects.
      this.todos = [];
      this.todos = await this.parseTodoDoc(n3doc);
    },
    async parseTodoDoc(doc) {
      console.log(doc);

      const query = `
      PREFIX cal: <http://www.w3.org/2002/12/cal/ical#>
      PREFIX schema: <http://schema.org/>

      SELECT ?name ?createdAt ?completedAt WHERE {
        ?todo a cal:Vtodo;
            schema:text ?name.
        OPTIONAL { ?todo cal:created ?createdAt }.
        OPTIONAL { ?todo cal:completed ?completedAt }.
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

      return bindings;
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
