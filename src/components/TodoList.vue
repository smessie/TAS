<template>
  <MDBContainer>
    <h1>👜 TAS - your Todo App with Solid</h1>

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
} from "mdb-vue-ui-kit";

export default {
  name: "TodoList",
  components: {
    MDBContainer,
    MDBListGroup,
    MDBListGroupItem,
    MDBInput,
    MDBBtn,
  },
  data() {
    return {
      newTodo: "",
      todos: [],
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
  },
  methods: {
    addTodo(event) {
      event.preventDefault();

      if (this.newTodo) {
        this.todos.push(this.newTodo);
        this.newTodo = "";
      }
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
</style>
