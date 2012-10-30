var require = function (module_name) {
    if (module_name.indexOf(".js", this.length - ".js".length) !== -1) {
        module_name = module_name.substring(0, module_name.length - 3);
    }

    if (module_name.indexOf("/") != -1) {
        module_name = module_name.substring(module_name.indexOf("/") + 1, module_name.length);
    }

    if (module_name === "underscore") {
        if (_) {
            return {"_" : _ };
        }
    }

    //console.log("requiring ", module_name);
    if (this[module_name] === undefined) {
        throw "module " + module_name + " not loaded!";
    }
    return this[module_name];
};