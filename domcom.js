// Fonctions de communications avec le thread principal (en charge du DOM)

// Just un log
function myLog(msg){
    postMessage({"console":JSON.stringify(msg)});
}

