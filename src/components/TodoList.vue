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
        <input class="form-check-input me-1" type="checkbox" value="" />
        {{ todo }}
      </MDBListGroupItem>
    </MDBListGroup>
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
} from "mdb-vue-ui-kit";
import {
  getDefaultSession,
  handleIncomingRedirect,
  login,
  fetch,
  logout,
} from "@inrupt/solid-client-authn-browser";

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
  },
  data() {
    return {
      newTodo: "",
      todos: [],
      loggedIn: undefined,
      oidcIssuer: "",
    };
  },
  created() {
    this.todos = [
      "Cras justo odio",
      "Dapibus ac facilisis in",
      "Morbi leo risus",
      "Porta ac consectetur ac",
      "Vestibulum at eros",
    ];

    handleIncomingRedirect({
      restorePreviousSession: true,
    }).then((info) => {
      this.loggedIn = info.webId;
    });
  },
  methods: {
    addTodo(event) {
      event.preventDefault();

      if (this.newTodo) {
        this.todos.push(this.newTodo);
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
