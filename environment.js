importScripts("graphe.js");

// Les environnements
// Il y a 4 environnements globaux: predef qui contient les constantes et fonctions fournies
// Graphes, qui contient les graphes, désignés par leurs noms
// Graphes.G.sommets qui contient les sommets du graph principal désignés par leurs noms
// Global, qui contient les variables globales et fonctions définies par l'utilisateur
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

    // Retourne l'environnement concerné par un symbole
    // Usage prévu : il ne s'agit pas d'une L-value (et n'est pas utilisé comme tel dans le code : on ne modifie a priori jamais envinnemnt[index])
    // mais d'un pointeur, qui a l'avantage de connaitre la nouvelle valeur si elle change après l'appel à getRef
    // l'usage est par exemple pour les expr.l de l'évaluation d'expression : la décision de ce à quoi se réfère un symbole
    // est faite une fois pour toute, mais ensuite expr.l peut être appelé de nombreuses fois
    getEnv(sym){
        const envs=[this.Local, this.Global, this.Graphes, this.G.sommets, this.Predef];
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
    get(sym){
        let e=this.getEnv(sym);
        if(e) return e[sym];
        return undefined;
    }

    // Retourne le graphe contenant un sommet donné
    grapheContaining(s){
        for(let i in this.Graphes){
            let g=this.Graphes[i];
            if(g.sommets[s.name]===s) return g;
        }
        return null;
    }
    
    // Environment concerné par un symbole en L-value
    // Si c'est déjà un symbole prédéfini, alors, c'est une erreur
    // Sinon, c'est par défaut l'environnement "Current" dans lequel on crée des valeurs (local ou global)
    // Sauf si c'est explicitement précisé qu'on parle de l'environnement global
    getIdlv(name){
        if(this.Predef[name]) throw{error:"env", name:"Surdéfinition", msg:"Vous ne pouvez modifier une variable prédéfinie", ln:lv.ln};
        if(this.Current[name]){
            if(this.Current[name].t=='global') return this.Global;
            return this.Current;
        }
        return this.Current;
    }

    // Même chose mais sous forme de L-value, c'est à dire de paire "environnement / index"
    // Et uniquement dans un environnement qu'on peut écrire sous forme d'affectation
    // (par exemple, pas sommets et graphes, puisqu'il est impossible d'écraser un sommet A en écrivant A=AutreSommet)
    getLVal(name){
        return [getIdlv(name), name]
    }

}

