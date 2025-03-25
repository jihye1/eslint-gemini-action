function CWE_129(x) { // ARRAY_INDEX_NEGATIVE
    var arr = [1, 2, 3];
    if (x < 0) {
        arr[x] = 3;
    }
}

function CWE_398() { // IDENTICAL_BRANCHES
    if (x >= 0) {
        y = x;
    } else {
        y = x;
    }
}

function CWE_476() { // NULL_POINTER
    var obj;
    var y = obj.x;
    console.log(y);
}

function CWE_480() { // BAD_BITWISE_OPERATOR
    var obj = null;
    if (obj & obj.prop) {
        console.log(obj.prop);
    }
}

function CWE_480_481() { // BAD_ASSIGN_IN_CONDITION
    var x = -1;
    if (x = -1) console.log('Error!', x);
}

function CWE_482_665() { // UNUSED_EXPR
    this.foo + 42;
}

function CWE_484() { // SWITCH_CASE_FALL_THROUGH
    var x;
    switch (x) {
    case '1': console.log('Do one thing');
    case '2': console.log('Do another thing');
    }
}

function CWE_489_569_570_571() { // CONSTANT_CONDITION
    var x = "Fo";
    var y = x + "Bar";
    if (y === "FooBar") {
        console.log('Do something');
    }
}

function CWE_561() { // UNREACHABLE_CODE
    return;

    var bar = 1;
    console.log(bar);
}

function CWE_563(url) { // UNUSED_VAR_ASSIGN
    var foo = url + "?query=deepscan";
    foo = url.replace(/\s/gi, "");
    console.log(foo);
}

function CWE_628() { // TOO_MANY_ARGS
    function add(x, y) {
        return x + y;
    }
    var sum = add(1, 2, 3);
    console.log(sum);
}

function CWE_670(x) { // STRAY_SEMICOLON
    while (++x <= 10) ;
    {
        sum += x;
    }
}

function CWE_685() { // MISMATCHED_COUNT_OF_ARGS
    return Math.atan2(a/b);
}

function CWE_843() { // BAD_TYPE_COERCION
    var backPosition;
    return "backgroundPosition: " + backPosition + "px; ";
}
