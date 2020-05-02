export function spinner(t, extraClasses = undefined) {
    return t.svg({className: Object.assign({"spinner": true}, extraClasses), viewBox:"0 0 100% 100%"}, 
        t.circle({cx:"50%", cy:"50%", r:"45%", pathLength:"100"})
    );
}