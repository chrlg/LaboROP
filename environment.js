importScripts("graphe.js");

// Les environnements
// Il y a 4 environnements globaux: predef qui contient les constantes et fonctions fournies
// Graphes, qui contient les graphes, désignés par leurs noms
// Graphes.G.sommets qui contient les sommets du graph principal désignés par leurs noms
// global, qui contient les variables globales et fonctions définies par l'utilisateur
// Et 1 environnement local, qui est créé à chaque appel de fonction
// Par défaut, l'envionnement local est l'environnement global. 
class Environnement {
    constructor(){
        // Environnement prédéfini. Contient les fonctions prédéfinies (random, print, ...)
        // Il est interdit de les écraser
        this.Predef = {}; 
        // Les Graphes. Dont le graphe par défaut, G
        this.Graphes = {};
        // Les variables globales
        this.Global = {};
        // Les variables locales (qui sont une pile d'environnements, pour les appels imbriqués)
        this.LocalEnvStack = [];
        // L'environnement local est le dernier de la pile (c'est juste plus pratique de l'avoir directement)
        this.Local = null;
        // L'environnement courant (celui dans lequel on écrit) = env local, sauf s'il n'y en a pas = env global
        this.Current = this.Global;

        // Il y a par défaut un graphe G
        this.addGraphe("G", 0);
    }

    // Méthode utilitaire : accèse à la variable "Oriente" de l'environnement
    // prédéfini, disant si un grave est orienté ou non
    isOrient(){
        if(this.Predef.Oriente===undefined) return undefined;
        else return this.Predef.Oriente.val;
    }
    setOrient(v){
        this.Predef["Oriente"]=v;
    }
    getPredef(name){
        return this.Predef[name];
    }

    addGraphe(name, ln){
        if(this.Graphes[name]){
            throw {error: "internal", msg: `Le graphe ${name} existe déjà`, name: "Erreur Interne", ln:ln}; 
        }
        this.Graphes[name] = new Graphe(name);
        if(name=='G') this.G = this.Graphes['G']
    }

    // Récupère l'objet désigné par "sym", par ordre de priorité "env local > env global > sommet > var prédéfinie"
    get(sym){
        let envs=[this.Local, this.Global, this.Graphes, this.G.sommets, this.Predef];
        for(let e of envs){
            if(e && envs[sym]!==undefined){
                if(e[sym].t=="global") continue; // Si ça existe dans l'environnement local, mais déclaré "global",
                return e[sym]; // il faut remonter plus loin (l'env global) pour trouver le vrai sens du symbole
            }
        }
        return undefined;
    }

    // Retourne le graphe contenant un sommet donné
    grapheContaining(s){
        for(let g of this.Graphes){
            if(g.sommets[s.name]===s) return g;
        }
        return null;
    }
    
    // Environment concerné par un symbole en L-value
    // Si c'est déjà un symbole prédéfini, alors, c'est une erreur
    // Sinon, c'est par défaut l'environnement "Current" dans lequel on crée des valeurs (local ou global)
    // Sauf si c'est explicitement précisé qu'on parle de l'environnement global
    // Ou s'il s'agit d'un graphe ou d'un sommet existant
    function getIdlv(name){
        if(this.Predef[name]) throw{error:"env", name:"Surdéfinition", msg:"Vous ne pouvez modifier une variable prédéfinie", ln:lv.ln};
        if(this.Current[name]){
            if(this.Current[name].t=='global') return this.Global;
            return this.Current;
        }
        if(this.Graphes[name]) return this.Graphes;
        if(this.G.sommets[name]) return this.G.sommets;
        return this.Current;
    }

}

