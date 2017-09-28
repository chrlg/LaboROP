var lexemes=[];
onmessage = function (e){
   var lex = lexico(e.data);
   if(lex.ERROR){
      postMessage(lex);
      return;
   }
   lexemes=lex;
   var prg = parseProgram();
   postMessage(prg);
}

var indentLevel=0;

function parseString(str){
   var r={index:-1, val:""};
   for(var i=1; i<str.length; i++){
      if(str[i]==str[0]) {
	 r.index=i+1;
	 break;
      }
      if(str[i]=='\n') break;
      if(str[i]=='\\'){
	 i++;
	 if(i>=str.length) break;
	 if(str[i]=="n") r.val+="\n";
	 else r.val += str[i];
      }
      else r.val += str[i];
   }
   return r;
}

function parseNumber(str){
   var r={index:0, val:{t:false, v:""}};
   r.val.v=str.match(/^[0-9]*/)[0];
   r.index=r.val.v.length;
   if(r.index>0) r.val.t="INT";
   if(str[r.index]=='.'){
      r.index++;
      r.val.t="FLOAT";
      r.val.v+=".";
      var virg=str.slice(r.index).match(/^[0-9]*/)[0];
      r.val.v+=virg;
      r.index+=virg.length;
   }
   var expo=str.slice(r.index).match(/^[Ee][0-9]+/);
   if(expo){
      r.index += expo[0].length;
      r.val.v += expo[0];
   }
   if(r.val.t=="INT") r.val.v=parseInt(r.val.v);
   else r.val.v=parseFloat(r.val.v);
   return r;
}

function lexico(str){
   var lex=[];
   var indents=[0];
   var newline=true;
   str+="\n\n";
   var numln=1;
   while (str != ""){
      // Tabulation en début de ligne => BEGIN/END
      if(newline){
	 var m=str.match(/[^ ]/);
	 if(m>0) str = str.slice(m.index);
	 var li=indents.pop();
	 indents.push(li);
	 newline=false;
	 if(m.index==li) continue;
	 if(m.index>li){
	    indents.push(m.index);
	    lex.push({t: "BEGIN", ln:numln});
	    continue;
	 }
	 li=indents.pop();
	 while(m.index<li){
	    lex.push({t: "END", ln:numln});
	    li=indents.pop();
	 }
	 if(m.index==li){
	    indents.push(li);
	 }else{
	    return {ERROR: "Erreur d'indentation", ln: numln};
	 }
      }

      // Commentaires
      if(str[0]=='#'){
	 str=str.slice(str.match(/\n/).index + 1);
	 numln++;
	 newline=true;
	 if(lex.length==0) continue;
	 if(lex[lex.length-1].t=="NL") continue;
	 lex.push({t:"NL", ln:numln-1});
	 continue;
      }

      // Fin de ligne
      if(str[0]=='\n'){
	 newline=true;
	 str=str.slice(1);
	 numln++;
	 if(lex.length==0) continue;
	 if(lex[lex.length-1].t=="NL") continue;
	 lex.push({t:"NL", ln:numln-1});
	 continue;
      }

      // Espaces
      if(str[0]==" "){
	 str=str.slice(str.match(/[^ ]/).index);
	 continue;
      }

      // Identifiants
      if(str[0].match(/[a-zA-Z_]/)){
	 var m=str.match(/^[a-zA-Z_0-9]+/);
	 var r={t: "I", v:m[0], ln:numln};
	 if(r.v=="def" || r.v=="Arete" || r.v=="Arc" || r.v=="Sommet" || r.v=="for" || r.v=="while" || r.v=="return" ||
	    r.v=="Gamma" || r.v=="Filtre" || r.v=="Premier" || r.v=="Dernier" || r.v=="True" || r.v=="False" || r.v=="random" || r.v=="Random"){
	    r.t="K";
	 }
	 lex.push(r);
	 str = str.slice(m[0].length);
	 continue;
      }

      // Chaines
      if(str[0]=='"'){
	 var r=parseString(str);
	 if(r.index<0) return {ERROR:"Chaîne non terminée", ln:numln};
	 str = str.slice(r.index);
	 lex.push({t: "STRING", v:r.val, ln:numln});
	 continue;
      }

      // Nombres
      if(str[0].match(/^[0-9]/) || (str[0]=='.' && str[1].match(/^[0-9]/))){
	 var r=parseNumber(str);
	 r.ln=numln;
	 lex.push(r.val);
	 str = str.slice(r.index);
	 continue;
      }
      
      // Opérateurs
      var bi=str.slice(0,2);
      if(bi=="+=" || bi=="-=" || bi=="==" || bi=="++" || bi=="--" || bi=="||" || bi=="&&" || bi=="**"){
	 lex.push({t:"OP", v:str.slice(0,2), ln:numln});
	 str = str.slice(2);
	 continue;
      }
      // Opérateur d'un seul caractère
      if(str[0].match(/[=,\[\]():.]/)){
	 lex.push({t:"OP", v:str[0], ln:numln});
	 str = str.slice(1);
	 continue;
      }

      // Inconnu
      return {ERROR: "Caractère <span>"+str[0]+"</span> illégal", ln: numln};
   }
   return lex;
}

function parseDefArgList(){
}

function parseDef(){
   if(lexemes.length<=0) return {ERROR: "Fin de fichier en pendant la définition d'une procédure", ln: 0};
   if(lexemes[0].t=="NL") return {ERROR: "Saut de ligne interdit pendant la définition d'une procédure", ln:lexemes[0].ln};
   if(lexemes[0].t!="I") return {ERROR: "Lexeme <span>"+lexemes[0].v+"</span> inattendu pendant la définition d'une procédure", ln:lexemes[0].ln};
   var name=lexemes[0].v;
   var args=parseDefArgList();
   return {t: "DEF", name:name, args:args, body:[]};
}

function parseInstruction(){
   if(lexemes.length<=0) return {ERROR: "Fin de fichier inattendue", ln:0};
   var ln=lexemes[0].ln;
   if(lexemes[0].t=="K" && lexemes[0].v=="Sommet"){
      lexemes=lexemes.slice(1);
      var lexpr=parseListeExpr();
      return {t: "SOMMET", args: lexpr, ln:ln};
   }
   return {ERROR: "Lexeme <span>"+lexemes[0].v+"</span> inattendu", ln:ln};
}

function parseListExpr(){
}


function parseProgram(){
   var prg=[];
   while(lexemes.length>0){
      if(lexemes[0].t=="I" && lexemes[0].v=="def"){
	 var ln=lexemes[0].ln;
	 lexemes=lexemes.slice(1);
	 var d=parseDef();
	 if(d.ERROR) {
	    if(d.ln==0) d.ln=ln;
	    return d;
	 }
	 prg += d;
	 continue;
      }
      else if(lexemes[0].t=="NL"){
	 lexemes=lexemes.slice(1);
	 continue;
      }
      else{
	 var d=parseInstruction();
	 if(d.ERROR) return d;
	 prg +=d;
	 continue;
      }
   }
   return prg;
}
