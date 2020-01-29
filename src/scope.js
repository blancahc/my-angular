'use strict';

var _ = require('lodash');

function Scope() {
    this.$$watchers = [];
    this.$$lastDirtyWatch = null;
    this.$$asyncQueue = [];
    this.$$applyAsyncQueue = [];
    this.$$applyAsyncId = null;
    this.$$phase = null;
}
function initWatchVal() { }

Scope.prototype.$watch = function (watchFn, listenerFn, valueEq) {
    var self = this;
    var watcher = {
        watchFn: watchFn,
        listenerFn: listenerFn || function() { },
        valueEq: !!valueEq,
        last: initWatchVal
    };
    this.$$watchers.unshift(watcher);
    this.$$lastDirtyWatch = null;
    return function() {
        var index = self.$$watchers.indexOf(watcher);
        if(index >= 0) {
            self.$$watchers.splice(index, 1);
            self.$$lastDirtyWatch = null;
        }
    };
};

Scope.prototype.$$digestOnce = function () {
    var self = this;
    var newValue, oldValue, dirty;
    _.forEachRight(this.$$watchers, function(watcher) {
        try { 
            if(watcher) { 
                newValue = watcher.watchFn(self);
                oldValue = watcher.last;
                if(!self.$$areEqual(newValue, oldValue, watcher.valueEq)) {
                    self.$$lastDirtyWatch = watcher;
                    watcher.last = (watcher.valueEq ? _.cloneDeep(newValue) : newValue);
                    watcher.listenerFn(newValue, (
                        oldValue === initWatchVal ? newValue : oldValue),
                        self);
                        dirty = true;
                } else if (self.$$lastDirtyWatch === watcher) {
                    return false;
                }
            }
    } catch(e) {
        console.error(e);
    }
    });
    return dirty;
};

Scope.prototype.$digest = function() {
    var ttl = 10;
    var dirty;
    this.$$lastDirtyWatch = null;
    this.$beginPhase('$digest');

    //if there was an $applySync request, clear it out since the digest is already running 
    //through a different call.
    if (this.$$applyAsyncId) {
        clearTimeout(this.$$applyAsyncId);
        this.$$flushApplyAsync();
    }

    do {
        while (this.$$asyncQueue.length) {
            var asyncTask = this.$$asyncQueue.shift();
            asyncTask.scope.$eval(asyncTask.expression);
        }
        dirty = this.$$digestOnce();
        if ((dirty || this.$$asyncQueue.length) && !(ttl--)) {
            this.$clearPhase();
            throw '10 digest iterations reached';
        }
    } while (dirty || this.$$asyncQueue.length);
    this.$clearPhase();
};

Scope.prototype.$$areEqual = function(newValue, oldValue, valueEq) {
    if(valueEq) {
        return _.isEqual(newValue, oldValue);
    } else {
        return newValue === oldValue || 
        (typeof newValue ==='number' && typeof oldValue === 'number' && 
        isNaN(newValue) && isNaN(oldValue));
    }
};

Scope.prototype.$eval = function(expr, locals) {
    return expr(this, locals);
};

//It is considered the standard way to integrate external libraries to Angular.
//takes a function as an argument. It executes that function using $eval, 
//and then kick- starts the digest cycle by invoking $digest.
Scope.prototype.$apply = function(expr) {
    try{
        this.$beginPhase('$apply');
        return this.$eval(expr);
    } finally {
        this.$clearPhase();
        this.$digest();
    }
};

//$evalAsync can be used to defer work from outside a digest, but it's really designed to be
//used to defer work from inside a digesr
Scope.prototype.$evalAsync = function(expr) {
    var self = this;
    if(!self.$$phase && !self.$$asyncQueue.length) {
        setTimeout(function() {
            if(self.$$asyncQueue.length) {
                self.$digest();
            }
        }, 0);
    }
    self.$$asyncQueue.push({scope: self, expression: expr});
};
//$applyAsync should not do a digest if one happens to be launched for some other 
//reason before the timeout triggers. In those cases the digest should drain the queue and 
//the $applyAsync timeout should be cancelled. the $$flushApplyAsync cancels the $applyAsync
Scope.prototype.$$flushApplyAsync = function() {
    while (this.$$applyAsyncQueue.length) {
        this.$$applyAsyncQueue.shift()();
    }
    this.$$applyAsyncId = null;
};
//to defer code from outside the digest
//When someone calls $applyAsync, we’ll push a function to the queue. 
//The function will later evaluate the given expression in the context of the scope, 
//just like $apply does.
Scope.prototype.$applyAsync = function(expr) {
    var self = this;
    self.$$applyAsyncQueue.push(function() {
        self.$eval(expr);
    });
    if (self.$$applyAsyncId === null) {
        self.$$applyAsyncId = setTimeout(function() {
            self.$apply(_.bind(self.$$flushApplyAsync, self));
        }, 0);
    }
};

Scope.prototype.$beginPhase = function(phase) {
    if(this.$$phase) {
        throw this.$$phase + ' already in progress.';
    }
    this.$$phase = phase;
};

Scope.prototype.$clearPhase = function() {
    this.$$phase = null;
};
module.exports = Scope;
