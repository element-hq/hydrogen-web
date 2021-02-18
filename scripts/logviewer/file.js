
export function openFile(mimeType = null) {
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.className = "hidden";
    if (mimeType) {
        input.setAttribute("accept", mimeType);
    }
    const promise = new Promise((resolve, reject) => {
        const checkFile = () => {
            input.removeEventListener("change", checkFile, true);
            const file = input.files[0];
            document.body.removeChild(input);
            if (file) {
                resolve(file);   
            } else {
                reject(new Error("no file picked"));
            }
        }
        input.addEventListener("change", checkFile, true);
    });
    // IE11 needs the input to be attached to the document
    document.body.appendChild(input);
    input.click();
    return promise;
}

export function readFileAsText(file) {
    const reader = new FileReader();
    const promise = new Promise((resolve, reject) => {
        reader.addEventListener("load", evt => resolve(evt.target.result));
        reader.addEventListener("error", evt => reject(evt.target.error));
    });
    reader.readAsText(file);
    return promise;
}