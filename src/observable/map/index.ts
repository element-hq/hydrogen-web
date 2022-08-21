// In order to avoid a circular dependency problem at runtime between BaseObservableMap
// and the classes that extend it, it's important that:
//
// 1) It always remain the first module exported below.
// 2) Anything that imports any of the classes in this module
//    ONLY import them from this index.ts file.
//
// See https://medium.com/visual-development/how-to-fix-nasty-circular-dependency-issues-once-and-for-all-in-javascript-typescript-a04c987cf0de
// for more on why this discipline is necessary.
export {BaseObservableMap} from './BaseObservableMap';
export type {Mapper, Updater, Comparator, Filter} from './BaseObservableMap';
export {ApplyMap} from './ApplyMap';
export {FilteredMap} from './FilteredMap';
export {JoinedMap} from './JoinedMap';
export {LogMap} from './LogMap';
export {MappedMap} from './MappedMap';
export {ObservableMap} from './ObservableMap';