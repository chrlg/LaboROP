/* © C. Le Gal 2017-2023 */
%lex

%{
%}
%x stringqqq
%x string
%x stringq

%%

"#".*			/* Ignore */
" "+			/* Ignore */
[\n]			return ";"

"§{"			return "BEGIN";
"§}"			return "END";
"§;"			return ";"

[0-9]+("."[0-9]+)?(("E"|"e")("-")?[0-9]+)?("d"|"D")\b	return 'DECIMAL'
[0-9]+("."[0-9]+)?(("E"|"e")"-"?[0-9]+)?\b	return 'NUMBER'

["]			this.begin("string"); yy._clg_stringBuf="";
<string>["]		this.popState(); yytext=yy._clg_stringBuf; return "STRING";
<string>"\\r"		yy._clg_stringBuf += "\r";
<string>[^"\\\n]	yy._clg_stringBuf += yytext;
<string>"\\n"		yy._clg_stringBuf += "\n";
<string>"\\"[^\n]	yy._clg_stringBuf += yytext.slice(1);

"'''"                   this.begin("stringqqq"); yy._clg_stringBuf="";
<stringqqq>"'''"        this.popState(); yytext=yy._clg_stringBuf; return "STRING";
<stringqqq>[^\\]        yy._clg_stringBuf += yytext;
<stringqqq>"\\".        yy._clg_stringBuf += yytext.slice(1);

[']			this.begin("stringq"); yy._clg_stringBuf="";
<stringq>[']		this.popState(); yytext=yy._clg_stringBuf; return "STRING";
<stringq>"\\r"		yy._clg_stringBuf += "\r";
<stringq>[^'\\\n]	yy._clg_stringBuf += yytext;
<stringq>"\\n"		yy._clg_stringBuf += "\n";
<stringq>"\\"[^\n]	yy._clg_stringBuf += yytext.slice(1);


"+="			return "+="
"*="                    return "*="
"-="			return "-="
"//="                   return "//="
"/="                    return "/="
"//"                    return "//"
"++"			return "++"
"--"			return "--"
"=="			return "=="
"^"                     return "**"
"!="			return "!="
"<="			return "<="
">="			return ">="
"&&"			return "&&"
"and"			return "&&"
"||"			return "||"
"or"			return "||"
"xor"                   return "xor"
"^^"                    return "xor"
".+"                    return ".+"
".**"                   return ".^"
"**"			return "**"
".*"                    return ".*"
".^"                    return ".^"

"[]"			return "[]"
"{}"                    return "{}"

"="			return "="
"["			return "["
"]"			return "]"
","			return ","
"("			return "("
")"			return ")"
":"			return ":"
"."			return "."
"+"			return "+"
"<"			return "<"
">"			return ">"
"-"			return "-"
"*"			return "*"
"%"			return "%"
"/"			return "/"
"?"			return "?"
"!"			return "!"
"$".*			return "$"

"Sommet"		return "Sommet"
"Arete"			return "Arete"
"Graphe"                return "Graphe"
"Arc"			return "Arc"
"def"			return "def"
"for"			return "for"
"while"			return "while"
"if"			return "if"
"else"			return "else"
"elif"                  return "elif"
"continue"		return "continue"
"break"			return "break"
"pass"                  return "pass"
"in"			return "in"
"global"		return "global"
"return"		return "return"
"range"			return "range"
"exit"			return "exit"

[A-Za-z_][A-Za-z0-9_]*	return "ID"

<<EOF>>               return 'EOF'
.                     return 'INVALID'

/lex

%left "Sommet"
%right ":" "?"
%left "||"
%left "xor"
%left "&&"
%left "=" "==" "!="
%left "<" ">" "<=" ">="
%left '.+' '+' '-'
%left '.*' '*' '//' '/' "%"
%left "**" ".^"
%right "++" "--" "!"
%left "++" "--"
%left "."

%start program

%% 

instructionNoColon
      : Sommet grapheSpec listeExpr {
	 $$ = { t:"SOMMET", g:$2, args:$3, ln:@1.first_line} ;
      }
      | Arete grapheSpec "[" expr "," expr "]" {
	 $$ = { t:"ARETE", g:$2, left: $4, right: $6, ln:@1.first_line};
      }
      | Arc grapheSpec "(" expr "," expr ")" {
	 $$ = { t:"Arc", g:$2, left:$4, right:$6, ln:@1.first_line};
      }
      | Graphe ID {
         $$ = { t:"Graphe", name:$2, ln:@1.first_line};
      }
      | llvalue "=" expr {
	 $$ = { t:"=", left: $1, right:$3, ln:@2.first_line};
      }
      | lvalue "+=" expr {
         $$ = { t:"+=", left:$1, right:$3, ln:@2.first_line};
      }
      | lvalue "*=" expr {
         $$ = { t:"*=", left:$1, right:$3, ln:@2.first_line};
      }
      | lvalue "-=" expr {
	 $$ = { t:"=", left: [$1], right: {t:"-", left:$1, right:$3, ln:@2.first_line}, ln:@2.first_line};
      }
      | lvalue "/=" expr {
         $$ = { t:"=", left:[$1], right:{t:"/", left:$1, right:$3, ln:@2.first_line}, ln:@2.first_line};
      }
      | lvalue "//=" expr {
         $$ = { t:"=", left:[$1], right:{t:"//", left:$1, right:$3, ln:@2.first_line}, ln:@2.first_line};
      }
      | lvalue "++" {
	 $$ = { t:"++", left: $1, ln:@2.first_line};
      }
      | "++" lvalue {
	 $$ = { t:"++", right: $1, ln:@1.first_line};
      }
      | lvalue "--" {
	 $$ = { t:"--", left: $1, ln:@2.first_line};
      }
      | "--" lvalue {
	 $$ = { t:"--", right: $1, ln:@1.first_line};
      }
      | ID '(' ')' {
	 $$ = { t:"call", f:$1, args:[], named:[], ln:@1.first_line};
      }
      | ID '(' listArg ')' {
	 $$ = { t:"call", f:$1, args:$3.p, named:$3.o, ln:@1.first_line};
      }
      | break {
	 $$ = {t:"break", ln:@1.first_line};
      }
      | continue {
	 $$ = {t:"continue", ln:@1.first_line};
      }
      | pass {
         $$ = {t:"pass", ln:@1.first_line};
      }
      | return {
	 $$ = {t:"return", val:undefined, ln:@1.first_line};
      }
      | return listeExpr {
	 $$ = {t:"return", val:$2, ln:@1.first_line};
      }
      | global listID {
	 $$ = {t:"global", vars:$2, ln:@1.first_line};
      }
      | exit '(' expr ')' {
	 $$ = {t:"exit", arg:$3, ln:@1.first_line};
      }
      | "BEGIN" manySemis "END" {
         $$ = {t:"pass"};
      }
      | "$" {
	 $$ = {t:"$", i:$1};
      }
      | STRING {
         $$ = {t:"string", val:$1, ln:@1.first_line};
      }
      ;
manySemis
      : {
         $$=false;
      }
      | ";" manySemis {
         $$=false;
      }
      ;

grapheSpec
      : {
         $$=false;
      }
      | "<" ID ">" {
         $$=$2;
      }
      ;

instruction
      : instructionNoColon ";" {
         $$ = $1;
      }
      | "for" lvalue "in" expr ":" blocOuSingle ";" {
	 $$ = { t:"foreach", compteur:$2, range:$4, do:$6, ln:@1.first_line};
      }
      | "for" lvalue "in" "range" "(" expr "," expr rangeStep ")" ":" blocOuSingle ";" {
	 $$ = { t:"for", compteur:$2, start:$6, end:$8, do:$12, step:$9, ln:@1.first_line};
      }
      | "for" lvalue "in" "range" "(" expr ")" ":" blocOuSingle ";" {
         $$ = { t:"for", compteur:$2, start:{t:"number", val:0}, end:$6, step:false, do:$9, ln:@1.first_line};
      }
      | while expr ":" blocOuSingle ";" {
	 $$ = { t:"while", cond:$2, do:$4, ln:@1.first_line };
      }
      | if expr ":" blocOuSingle ";" {
	 $$ = { t:"if", cond:$2, do:$4, else:[], ln:@1.first_line };
      }
      | if expr ":" blocOuSingle ";" elifs {
         $$ = { t:"if", cond:$2, do:$4, else:$6, ln:@1.first_line};
      }
      ;

elifs
      : "elif" expr ":" blocOuSingle ";" {
         $$ = [{ t:"if", cond:$2, do:$4, else:[], ln:@1.first_line}];
      }
      | "elif" expr ":" blocOuSingle ";" elifs {
         $$ = [{ t:"if", cond:$2, do:$4, else:$6, ln:@1.first_line}];
      }
      | "else" ":" blocOuSingle ";" {
         $$ = $3;
      }
      ;

rangeStep
      : "," expr {
	 $$ = $2;
      }
      | {
	 $$ = false;
      }
      ;

namedArgs
      : ID "=" expr {
        $$ = [{name:$1, a:$3}];
      }
      | ID "=" expr "," namedArgs {
        $$ = $5;
        $$.unshift({name:$1, a:$3});
      }
      ;

listArg
      : namedArgs {
         $$ = {p:[], o:$1};
      }
      | expr {
        $$ = {p:[$1], o:[]};
      }
      | expr "," listArg {
        $$=$3;
        $$.p.unshift($1);
      }
      ;
      
      
listeExpr
      : expr {
	 $$ = [$1];
      } | listeExpr "," expr {
	 $$ = $1; $$.push($3);
      }
      ;

atomicExpr
      : NUMBER {
	 $$={t:"number", val:parseFloat($1), ln:@1.first_line};
      }
      | DECIMAL {
         $$={t:"DECIMAL", s:$1.slice(0,-1), ln:@1.first_line};
      }
      | STRING {
	 $$={t:"string", val:$1, ln:@1.first_line};
      }
      | ID '(' ')' {
	 $$={t: "call", f:$1, args:[], named:[], ln:@1.first_line};
      }
      | ID '(' listArg ')' {
	 $$={t: "call", f:$1, args:$3.p, named:$3.o, ln:@1.first_line};
      }
      | "[]" {
	 $$={t: "array", val:[], ln:@1.first_line};
      }
      | "{}" {
         $$={t:"struct", f:[], ln:@1.first_line};
      }
      | "(" ID "," ID ")" {
	 $$={t: "arc", initial:$2, terminal:$4, ln:@3.first_line};
      }
      ;

placeExpr 
      : ID {
	 $$ = {t:"id", name:$1, ln:@1.first_line};
      }
      | expr "." ID {
	 $$={t: "field", o:$1, f:$3, ln:@2.first_line};
      }
      | placeExpr "[" expr "]" {
	 $$={t:"index", tab:$1, index:$3, ln:@2.first_line};
      }
      | placeExpr "[" expr "," expr "]" {
         $$={t:"mindex", mat:$1, i:$3, j:$5, ln:@2.first_line};
      }
      | placeExpr "[" borne ":" borne "]" {
         $$={t:"subarray", tab:$1, indexinf:$3, indexsup:$5, ln:@2.firstline};
      }
      ;
      

expr
      : atomicExpr {
         $$ = $1;
      }
      | placeExpr {
         $$ = $1;
      }
      | expr "<" expr {
	 $$ = {t:"<", left:$1, right:$3, ln:@2.first_line};
      }
      | expr "==" expr {
	 $$ = {t:"==", left:$1, right:$3, ln:@2.first_line};
      }
      | expr "!=" expr {
	 $$ = {t:"!=", left:$1, right:$3, ln:@2.first_line};
      }
      | expr ">" expr {
	 $$ = {t:">", left:$1, right:$3, ln:@2.first_line};
      }
      | expr ">=" expr {
	 $$ = {t:">=", left:$1, right:$3, ln:@2.first_line};
      }
      | expr "<=" expr {
	 $$ = {t:"<=", left:$1, right:$3, ln:@2.first_line};
      }
      | expr "+" expr {
	 $$ = {t:"+", left:$1, right:$3, ln:@2.first_line};
      }
      | expr "-" expr {
	 $$ = {t:"-", left:$1, right:$3, ln:@2.first_line};
      }
      | "-" expr {
         $$ = {t:"-", left:{t:"number", val:0}, right:$2, ln:@1.first_line};
      }
      | expr "*" expr {
	 $$ = {t:"*", left:$1, right:$3, ln:@2.first_line};
      }
      | expr "/" expr {
	 $$ = {t:"/", left:$1, right:$3, ln:@2.first_line};
      }
      | expr "//" expr {
	 $$ = {t:"//", left:$1, right:$3, ln:@2.first_line};
      }
      | expr "%" expr {
	 $$ = {t:"%", left:$1, right:$3, ln:@2.first_line};
      }
      | expr "**" expr {
	 $$ = {t:"**", left:$1, right:$3, ln:@2.first_line};
      }
      | expr ".+" expr {
	 $$ = {t:".+", left:$1, right:$3, ln:@2.first_line};
      }
      | expr ".*" expr {
	 $$ = {t:".*", left:$1, right:$3, ln:@2.first_line};
      }
      | expr ".^" expr {
	 $$ = {t:".^", left:$1, right:$3, ln:@2.first_line};
      }
      | expr "++" {
	 $$ = {t:"++", left:$1, right:undefined, ln:@2.first_line};
      }
      | "++" expr {
	 $$ = {t:"++", left:undefined, right:$2, ln:@1.first_line};
      }
      | expr "--" {
	 $$ = {t:"--", left:$1, right:undefined, ln:@2.first_line};
      }
      | "--" expr {
	 $$ = {t:"--", left:undefined, right:$2, ln:@1.first_line};
      }
      | expr "?" expr ":" expr {
	 $$ = {t:"?:", cond:$1, oui:$3, non:$5, ln:@2.first_line};
      }
      | expr "&&" expr {
	 $$ = {t:"&&", left:$1, right:$3, ln:@2.first_line};
      }
      | expr "||" expr {
	 $$ = {t:"||", left:$1, right:$3, ln:@2.first_line};
      }
      | expr "xor" expr {
         $$ = {t:"xor", left:$1, right:$3, ln:@2.first_line};
      }
      | "!" expr {
	 $$ = {t:"!", right:$2, ln:@1.first_line};
      }
      | "(" expr ")" {
	 $$ = $2;
      }
      | "Sommet" grapheSpec expr {
	 $$={t:"SOMMET", g:$2, arg:$3, ln:@1.first_line};
      }
      | "Arc" grapheSpec "(" expr "," expr ")" {
	 $$ = { t:"Arc", g:$2, left:$4, right:$6, ln:@1.first_line};
      }
      | "Arete" grapheSpec "[" expr "," expr "]" {
	 $$ = { t:"Arete", g:$2, left:$4, right:$6, ln:@1.first_line};
      }
      | "[" bracketExpr "]" {
         $$ = $2;
         $$.ln=@1.first_line;
      }
      ;

bracketExpr 
      : expr {
         $$ = {t:"staticArray", args:[$1], ln:@1.first_line};
      }
      | expr "," {
         $$ = {t:"staticArray", args:[$1], ln:@1.first_line};
      }
      | expr "," expr {
         $$ = {t:"exprArete", initial:$1, terminal:$3, ln:@1.fist_line};
      }
      | expr "," expr "," bracketExpr3 {
         $$ = {t:"staticArray", args:[$1,$3].concat($5), ln:@1.first_line};
      }
      ;

bracketExpr3
      : {
         $$=[];
      }
      | listeExpr {
         $$=$1;
      }
      ;

borne
      : expr {
         $$=$1;
      }
      | {
         $$=false;
      }
      ;

lvalue
      : ID {
	 $$ = {t:"id", name:$1, ln:@1.first_line};
      }
      | "(" ID "," ID ")" {
	 $$={t: "arc", initial:$2, terminal:$4, ln:@3.first_line};
      }
      | "[" ID "," ID "]" {
	 $$={t:"arete", initial: $2, terminal: $4, ln:@3.first_line};
      }
      | lvalue "." ID {
	 $$={t: "field", o:$1, f:$3, ln:@2.first_line};
      }
      | lvalue "[" expr "]" {
	 $$={t:"index", tab:$1, index:$3, ln:@2.first_line};
      }
      | lvalue "[" expr "," expr "]" {
         $$={t:"mindex", mat:$1, i:$3, j:$5, ln:@2.first_line};
      }
      ;

llvalue
      : lvalue {
	 $$=[$1];
      }
      | llvalue "," lvalue {
	 $$=$1;
	 $$.push($3);
      }
      ;

blocOuSingle
      : instructionNoColon {
	 $$ = [$1];
      }
      | bloc {
         $$ = $1;
      }
      ;

bloc
      : ";" "BEGIN" listInst "END" {
	 $$ = $3;
      }
      ;

listInst 
      : {
	 $$ = [];
      }
      | ";" listInst {
	 $$=$2;
      }
      | instruction listInst {
	 $$ = $2;
	 $$.unshift($1);
      }
      ;

definition
      : "def" ID listParamsParenthesis ":" bloc ";" {
	 $$ = {t:"DEF", nom: $2, args:$3.p, opt:$3.o, insts: $5, ln:@1.first_line};
      }
      ;

listParamsParenthesis
      : "(" ")" {
	 $$={p:[], o:[]};
      }
      | "(" listParams ")" {
	 $$=$2;
      }
      ;

listParams
      : ID {
        $$={p:[$1],o:[]};
      }
      | ID "," listParams {
	 $$=$3;
	 $$.p.unshift($1);
      }
      | optParams {
        $$={p:[], o:$1};
      }
      ;

optParam 
      : ID "=" expr {
        $$={name:$1, v:$3};
      }
      ;

optParams
      : optParam {
        $$=[$1];
      }
      | optParam "," optParams {
	 $$=$3;
	 $$.unshift($1);
      }
      ;

listID 
      : ID {
	 $$=[$1];
      }
      | ID "," listID {
	 $$=$3;
	 $$.unshift($1);
      }
      ;

listeInstOuDef
      : EOF {
	 $$ = [];
      }
      | instruction listeInstOuDef {
	 $$ = $2;
	 $$.unshift($1);
      } 
      | definition listeInstOuDef {
	 $$ = $2;
	 $$.unshift($1);
      } 
      | ";" listeInstOuDef {
	 $$=$2;
      }
      ;

program
      : listeInstOuDef { 
	 return $1;
      }
      ;


%%

// © C. Le Gal 2017-2023
