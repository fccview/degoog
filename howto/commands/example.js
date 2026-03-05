export default {
  name: "Example",
  description: "An example bang command",
  trigger: "example",
  async execute(args) {
    return {
      title: "Example Command",
      html: `<div class="command-result"><p>You ran <code>!example</code> with args: <strong>${args || "(none)"}</strong></p></div>`,
    };
  },
};
