// ESLint Rule: prefer-const
// it's initialized and never reassigned.
let a = 3;
console.log(a);

// ESLint Rule: no-console
console.log("This should trigger a warning.");

// ESLint Rule: no-shadow
const aa = 3;
function bb() {
    const aa = 10;
}

// ESLint Rule: eqeqeq
const name = "eslint";
if (name == null) {
  console.log("Null check with ==");
}

// ESLint Rule: no-debugger
debugger;

// ESLint Rule: no-cond-assign
let x = 0;
if (x = 10) {
  console.log("Assignment in condition");
}

// ESLint Rule: jsx-a11y/img-has-alt
const Logo = () => <img src="logo.png" />;

// ESLint Rule: jsx-a11y/click-events-have-key-events
const Button = () => <div onClick={() => alert("clicked")}>Click me</div>;

// ESLint Rule: react/jsx-no-undef
const App = () => <NonExistingComponent />;

// ESLint Rule: @typescript-eslint/no-explicit-any
function handleData(data: any) {
  return data;
}
