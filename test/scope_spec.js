'use strict';

var Scope = require('../src/scope');

describe('Scope', function (){
    it('can be constructed and used as an object', function() {
        var scope = new Scope();
        scope.aProperty = 1;
        expect(scope.aProperty).toBe(1);
    });
    describe('digest', function() {
        var scope;
        beforeEach(function() {
            scope = new Scope();
        });
        it('calls the listener function of a watch on first $digest', function() {
            var watchFn = function() { return 'wat'; };
            var listenerFn = jasmine.createSpy();
            scope.$watch(watchFn, listenerFn);

            scope.$digest();

            expect(listenerFn).toHaveBeenCalled();
        });
        it('calls the watch function with the scope as the argument', function() {
            var watchFn    = jasmine.createSpy();
            var listenerFn = function() { };
            scope.$watch(watchFn, listenerFn);
            
            scope.$digest();
            
            expect(watchFn).toHaveBeenCalledWith(scope);
          });
          it('calls the listener function when the watched value changes', function() { 
              //We first plop two attributes on the scope: A string and a number.
              scope.someValue = 'a';
              scope.counter = 0;
              
              // we run the scope.$watch() defined in scope.js, which adds functions to scope.$$watchers. First argument is the watcher, second is the listener.
              scope.$watch(
                  //We then attach a watcher that watches the string and increments the number when the string changes.
                  function(scope) { return scope.someValue; },
                  //We specify the contract of the listener function: it takes the scope as an argument. 
                  //It’s also given the new and old values of the watcher. 
                  //This makes it easier for application developers to check what exactly has changed.
                 function(newValue, oldValue, scope) { scope.counter++; }
              );

              expect(scope.counter).toBe(0);
              
              //The expectation is that the counter is incremented once during the first $digest, and then once every subsequent $digest if the value has changed.

              scope.$digest();
              expect(scope.counter).toBe(1);

              scope.$digest();
              expect(scope.counter).toBe(1);

              scope.someValue = 'b'; 
              expect(scope.counter).toBe(1);
                
              scope.$digest();
              expect(scope.counter).toBe(2);
          });
          it('call listener with new value as old value the first time', function() {
              scope.someValue = 123;
              var oldValueGiven;
              
              scope.$watch(
                  function(scope) { return scope.someValue; },
                  function(newValue, oldValue, scope) { oldValueGiven = oldValue; }
              );

              scope.$digest();
              expect(oldValueGiven).toBe(123);
          });
    });
});