/*
Copyright 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

export class Disambiguator {
    constructor() {
        this._map = new Map();
    }

    _unDisambiguate(vm, array) {
        const idx = array.indexOf(vm);
        if (idx !== -1) {
            const [removed] = array.splice(idx, 1);
            removed.setDisambiguation(false);
        }
    }

    _handlePreviousName(vm) {
        const previousName = vm.previousName;
        if (typeof previousName !== "string") { return; }
        const value = this._map.get(previousName);
        if (Array.isArray(value)) {
            this._unDisambiguate(vm, value);
            if (value.length === 1) {
                const vm = value[0];
                vm.setDisambiguation(false);
                this._map.set(previousName, vm);
            }
        } else {
            this._map.delete(previousName);
        }
    }

    _updateMap(vm) {
        const name = vm.name;
        const value = this._map.get(name);
        if (value) {
            if (Array.isArray(value)) {
                if (value.findIndex(member => member.userId === vm.userId) !== -1) { return; }
                value.push(vm);
                return value;
            } else if(vm.userId !== value.userId) {
                const array = [value, vm];
                this._map.set(name, array);
                return array;
            }
        } else {
            this._map.set(name, vm);
        }
    }

    disambiguate(vm) {
        if (!vm.nameChanged) { return; }
        this._handlePreviousName(vm);
        const value = this._updateMap(vm);
        value?.forEach((vm) => vm.setDisambiguation(true));
    }
}

export function tests(){

    class MockViewModel {
        constructor(name, userId) {
            this.name = name;
            this.disambiguate = false;
            this.userId = userId;
            this.nameChanged = true;
        }
        
        updateName(newName) {
            if (this.name !== newName) {
                this.previousName = this.name;
                this.nameChanged = true;
            }
            else {
                this.nameChanged = false;
            }
            this.name = newName;
        }

        setDisambiguation(status) {
            this.disambiguate = status;
        }
    }

    function createVmAndDisambiguator(nameList) {
        const d = new Disambiguator();
        const array = nameList.map(([name, id]) => new MockViewModel(name, id));
        return [...array, d];
    }

    return {
        "Unique names": assert => {
            const [vm1, vm2, d] = createVmAndDisambiguator([["foo", "a"], ["bar", "b"]]);
            d.disambiguate(vm1);
            d.disambiguate(vm2);
            assert.strictEqual(vm1.disambiguate, false);
            assert.strictEqual(vm2.disambiguate, false);
        },

        "Same names are disambiguated": assert => {
            const [vm1, vm2, vm3, d] = createVmAndDisambiguator([["foo", "a"], ["foo", "b"], ["foo", "c"]]);
            d.disambiguate(vm1);
            d.disambiguate(vm2);
            d.disambiguate(vm3);
            assert.strictEqual(vm1.disambiguate, true);
            assert.strictEqual(vm2.disambiguate, true);
            assert.strictEqual(vm3.disambiguate, true);
        },

        "Name updates disambiguate": assert => {
            const [vm1, vm2, vm3, d] = createVmAndDisambiguator([["foo", "a"], ["bar", "b"], ["jar", "c"]]);
            d.disambiguate(vm1);
            d.disambiguate(vm2);
            d.disambiguate(vm3);
            
            vm2.updateName("foo");
            d.disambiguate(vm2);
            assert.strictEqual(vm1.disambiguate, true);
            assert.strictEqual(vm2.disambiguate, true);

            vm1.updateName("bar");
            d.disambiguate(vm1);
            assert.strictEqual(vm1.disambiguate, false);
            assert.strictEqual(vm2.disambiguate, false);

            vm3.updateName("foo");
            d.disambiguate(vm3);
            vm1.updateName("foo");
            d.disambiguate(vm1);
            assert.strictEqual(vm1.disambiguate, true);
            assert.strictEqual(vm2.disambiguate, true);
            assert.strictEqual(vm3.disambiguate, true);

            vm2.updateName("bar");
            d.disambiguate(vm2);
            assert.strictEqual(vm1.disambiguate, true);
            assert.strictEqual(vm2.disambiguate, false);
            assert.strictEqual(vm3.disambiguate, true);
        },

        "Multiple disambiguate events": assert => {
            const [vm1, d] = createVmAndDisambiguator([["foo", "a"]]);
            d.disambiguate(vm1);
            vm1.updateName(vm1.name);
            d.disambiguate(vm1);
            assert.strictEqual(vm1.disambiguate, false);
        },

        "Empty names must un-disambiguate": assert => {
            const [vm1, vm2, d] = createVmAndDisambiguator([["", "a"], ["", "b"]]);
            d.disambiguate(vm1);
            d.disambiguate(vm2);
            vm1.updateName("foo");
            d.disambiguate(vm1);
            assert.strictEqual(vm1.disambiguate, false);
            assert.strictEqual(vm2.disambiguate, false);
        }
    };
}
