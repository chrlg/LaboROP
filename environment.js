import {Graphe} from "./graphe.js";
import populatePredef from "./predef.js";

// Les environnements
// Il y a 4 environnements globaux: predef qui contient les constantes et fonctions fournies
// Graphes, qui contient les graphes, désignés par leurs noms
// Graphes.G.sommets qui contient les sommets du graph principal désignés par leurs noms
// Global, qui contient les variables globales et fonctions définies par l'utilisateur
// Et 1 environnement local, qui est créé à chaque appel de fonction
// Par défaut, l'envionnement local est l'environnement global. 

// Environnement prédéfini. Contient les fonctions prédéfinies (random, print, ...)
// Il est interdit de les écraser
export let Predef = {};

// Les Graphes. Dont le graphe par défaut, G
export let Graphes = {};
export let G=null;

// Les variables globales
export let Global = {};

// Les variables locales (qui sont une pile d'environnements, pour les appels imbriqués)
export let LocalEnvStack = [];

// L'environnement local est le dernier de la pile (c'est juste plus pratique de l'avoir directement)
export let Local = null;

// L'environnement courant (celui dans lequel on écrit) = env local, sauf s'il n'y en a pas = env global
export let Current = Global;

// Reset all modifiable env (for new interpret run)
export function reset(){
    Graphes={};
    Global={};
    LocalEnvStack=[];
    Local=null;
    Current=Global;
    addGraphe("G", 0);
}

// Add a new Graph to the environment
// If that graphe name is G, then, update helper global value G
export function addGraphe(name, ln){
    if(Graphes[name]){
        throw {error: "internal", msg: `Le graphe ${name} existe déjà`, name: "Erreur Interne", ln:ln}; 
    }
    Graphes[name] = new Graphe(name);
    if(name=='G') G = Graphes['G']
}

// Get predefined value name
export function getPredef(name){
    return Predef[name];
}

// Add predefined function name
export function addPredfn(name, fn){
    if(Predef[name]) throw {error:"internal", name:"Erreur interne", msg:`Double définition de symbole prédéfini ${name}`, ln:ln};
    Predef[name] = {t:"predfn", f:fn};
}

// Add predefined nonstatic variables (variables from the point of view of pyro, but function here in JS)
export function addPredvar(name, fn, optarg=true){
    if(Predef[name]) throw {error:"internal", name:"Erreur interne", msg:`Double définition de symbole prédéfini ${name}`, ln:ln};
    Predef[name] = {t:"predvar", f:fn};
    if(optarg) Predef[name]['optarg']=true;
}

// Get a graphe by its name
// If name is false/undefined, return graph G
export function getGraph(name, ln){
   if(name){
      if(!Graphes[name]) throw {error:"env", name:"Graphe non existant", msg:"Le graphe "+name+" n'existe pas", ln:ln};
      return Graphes[name];
   }
   return G;
}

// Return graph containing a given node s
function grapheContaining(s){
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
    const envs=[Local, Global, Graphes, G.sommets, Predef];
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
function getIdlv(name){
    if(this.Predef[name]) throw{error:"env", name:"Surdéfinition", msg:"Vous ne pouvez modifier une variable prédéfinie", ln:lv.ln};
    if(this.Current[name]){
        if(this.Current[name].t=='global') return this.Global;
        return this.Current;
    }
    return this.Current;
}


export class Environnement {
    
    // Même chose mais sous forme de L-value, c'est à dire de paire "environnement / index"
    // Et uniquement dans un environnement qu'on peut écrire sous forme d'affectation
    // (par exemple, pas sommets et graphes, puisqu'il est impossible d'écraser un sommet A en écrivant A=AutreSommet)
    getLVal(name){
        return [getIdlv(name), name]
    }

}

populatePredef();
