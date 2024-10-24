import {Graphe} from "./graphe.js";
import populatePredef from "./predef.js";

// Les environnements
// Il y a 4 environnements globaux: predef qui contient les constantes et fonctions fournies
// Graphes, qui contient les graphes, désignés par leurs noms
// Graphes.Gr.sommets qui contient les sommets du graph principal désignés par leurs noms
// Global, qui contient les variables globales et fonctions définies par l'utilisateur
// Et 1 environnement local, qui est créé à chaque appel de fonction
// Par défaut, l'envionnement local est l'environnement global. 

// Environnement prédéfini. Contient les fonctions prédéfinies (random, print, ...)
// Il est interdit de les écraser
export let Predef = {};

// Les Graphes. Dont le graphe par défaut, Gr
export let Graphes = {};
export let Gr=null;

// Les variables globales
export let Global = {};

// Les variables locales (qui sont une pile d'environnements, pour les appels imbriqués)
export let LocalEnvStack = [];

// L'environnement local est le dernier de la pile (c'est juste plus pratique de l'avoir directement)
export let Local = null;

// L'environnement courant (celui dans lequel on écrit) = env local, sauf s'il n'y en a pas = env global
export let Current = Global;

// Reset all modifiable env (for new interpret run)
export let OpCnt=0; // Operation count (not directly related to environment, but this is where global vars are, and this is a virtual global var)

export function addCnt(a){
    OpCnt += a;
}

export function reset(){
    Graphes={};
    Global={};
    LocalEnvStack=[];
    Local=null;
    Current=Global;
    addGraphe("Gr", 0);
    OpCnt=0;
}

export function push(env){
    LocalEnvStack.push(env);
    Local=env;
    Current=env;
    return env;
}

export function pop(){
    if(LocalEnvStack.length==0) throw {error:"interne", name:"Erreur interne", msg:"Pop env of empty stack", ln:0};
    let e=LocalEnvStack.pop();
    if(LocalEnvStack.length==0){
        Local=null;
        Current=Global;
    }else{
        Local=LocalEnvStack[LocalEnvStack.length-1];
        Current=Local;
    }
    return e;
}

// Add a new Graph to the environment
// If that graphe name is Gr, then, update helper global value Gr
export function addGraphe(name, ln){
    if(Graphes[name]){
        throw {error: "internal", msg: `Le graphe ${name} existe déjà`, name: "Erreur Interne", ln:ln}; 
    }
    let g=new Graphe(name);
    Graphes[name] = g;
    if(name=='Gr') Gr = g;
    return g;
}

// Get predefined value name
export function getPredef(name){
    return Predef[name];
}

// Add predefined function name
export function addPredfn(name, fn){
    if(Predef[name]) throw {error:"internal", name:"Erreur interne", msg:`Double définition de symbole prédéfini ${name}`, ln:0};
    Predef[name] = {t:"predfn", f:fn, name:name};
}

// Add predefined nonstatic variables (variables from the point of view of pyro, but function here in JS)
export function addPredvar(name, fn, optarg=true){
    if(Predef[name]) throw {error:"internal", name:"Erreur interne", msg:`Double définition de symbole prédéfini ${name}`, ln:0};
    Predef[name] = {t:"predvar", f:fn};
    if(optarg) Predef[name]['optarg']=true;
}

// Get a graphe by its name
// If name is false/undefined, return graph Gr
export function getGraph(name, ln){
   if(name){
      if(!Graphes[name]) throw {error:"env", name:"Graphe non existant", msg:"Le graphe "+name+" n'existe pas", ln:ln};
      return Graphes[name];
   }
   return Gr;
}

// Return graph containing a given node s
export function grapheContaining(s){
    for(let i in Graphes){
        let g=Graphes[i];
        if(g.sommets[s.name]===s) return g;
    }
    return null;
}

// Retourne l'environnement concerné par un symbole
// Usage prévu : il ne s'agit pas d'une L-value (et n'est pas utilisé comme tel dans le code : on ne modifie a priori jamais envinnemnt[index])
// mais d'un pointeur, qui a l'avantage de connaitre la nouvelle valeur si elle change après l'appel à getRef
// l'usage est par exemple pour les expr.l de l'évaluation d'expression : la décision de ce à quoi se réfère un symbole
// est faite une fois pour toute, mais ensuite expr.l peut être appelé de nombreuses fois
export function getEnv(sym){
    const envs=[Local, Global, Graphes, Gr.sommets, Predef];
    for(let e of envs){
        if(e && e[sym]!==undefined){
            if(e[sym].t=="global") continue; // Si ça existe dans l'environnement local, mais déclaré "global",
                                             // il faut remonter plus loin (l'env global) pour trouver le vrai sens du symbole
            return e
        }
    }
    return undefined;
}

// Récupère l'objet désigné par "sym", par ordre de priorité "env local > env global > sommet > var prédéfinie"
export function get(sym){
    let e=getEnv(sym);
    if(e) return e[sym];
    return undefined;
}

// Environment concerned by a l-value symbol
// It symbol is of a predefined function of var, that is an error
// Otherwise, if that symbol has been declared as global, it is the global environment
// Otherwise it is the current environment (that may be a local one, or the global one)
export function getIdlv(name, ln){
    if(Predef[name]) throw{error:"env", name:"Surdéfinition", msg:"Vous ne pouvez modifier une variable prédéfinie", ln:ln};
    if(Gr.sommets[name]) throw{error:"env", name:"Surdéfinition", msg:"Vous ne pouvez pas affecter un sommet existant", ln:ln};
    if(Graphes[name]) throw{error:"env", name:"Surdéfinition", msg:"Vous ne pouvez pas affecter un graphe existant", ln:ln};
    if(Current[name]){
        if(Current[name].t=='global') return Global;
        return Current;
    }
    return Current;
}


populatePredef();
