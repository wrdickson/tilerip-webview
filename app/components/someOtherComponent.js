// Define a new component called todo-item
Vue.component('some-other-component', {
  template: `
    <div>
      <div>someOtherComponent</div>
      <v-text-field
        label="Text here"
      ></v-text-field>
      <v-btn
        color="success"
      >Button
      </v-btn>
    </div>
  `,
  name: "SomeOtherComponent"
})