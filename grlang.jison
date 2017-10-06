%lex

%{
%}
%x string
%x stringq

%%

"#".*			/* Ignore */
" "+			/* Ignore */
[\n]			return ";"

"§{"			return "BEGIN";
"§}"			return "END";
"§;"			return ";"

[0-9]+("."[0-9]+)?("E"[0-9]+)?\b	return 'NUMBER'

["]			this.begin("string"); _clg_stringBuf="";
<string>["]		this.popState(); yytext=_clg_stringBuf; return "STRING";
<string>[^"\\\n]	_clg_stringBuf += yytext;
<string>"\\n"		_clg_stringBuf += "\n";
<string>"\\"[^\n]		_clg_stringBuf += yytext.slice(1);

[']			this.begin("stringq"); _clg_stringBuf="";
<stringq>[']		this.popState(); yytext=_clg_stringBuf; return "STRING";
<stringq>[^'\\\n]	_clg_stringBuf += yytext;
<stringq>"\\n"		_clg_stringBuf += "\n";
<string>"\\"[^\n]	_clg_stringBuf += yytext.slice(1);

"+="			return "+="
"++"			return "++"
"--"			return "--"
"=="			return "=="
"-="			return "-="
"**"			return "**"
"!="			return "!="
"<="			return "<="
">="			return ">="
"&&"			return "&&"
"and"			return "&&"
"||"			return "||"
"or"			return "||"

"[]"			return "[]"

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
"Arc"			return "Arc"
"Gamma"			return "Gamma"
"def"			return "def"
"for"			return "for"
"while"			return "while"
"if"			return "if"
"else"			return "else"
"continue"		return "continue"
"break"			return "break"
"in"			return "in"
"global"		return "global"
"return"		return "return"
"range"			return "range"
"exit"			return "exit"

[A-Za-z_][A-Za-z0-9_]*	return "ID"

<<EOF>>               return 'EOF'
.                     return 'INVALID'

/lex

%right ":" "?"
%left "||"
%left "&&"
%left "=" "==" "!="
%left "<" ">" "<=" ">="
%left '+' '-'
%left '*' '/' "%"
%left "**"
%right "++" "--" "!"
%left "++" "--"
%left "."

%start program

%% 

id 
      : ID {
	 $$ = {t:"id", name:$1, ln:@1.first_line};
      }
      ;

instruction
      : Sommet listeExpr {
	 $$ = { t:"SOMMET", args:$2, ln:@1.first_line} ;
      }
      | Arete "[" expr "," expr "]" {
	 $$ = { t:"ARETE", left: $3, right: $5, ln:@1.first_line};
      }
      | Arc "(" expr "," expr ")" {
	 $$ = { t:"Arc", left:$3, right:$5, ln:@1.first_line};
      }
      | "Gamma" "(" expr ")" "+=" expr {
	 $$ = { t:"ArcOuArete", left:$3, right:$6, ln:@1.first_line};
      }
      | llvalue "=" expr {
	 $$ = { t:"=", left: $1, right:$3, ln:@2.first_line};
      }
      | lvalue "+=" expr {
	 $$ = { t:"+=", left: $1, right: $3, ln:@2.first_line};
      }
      | lvalue "-=" expr {
	 $$ = { t:"-=", left: $1, right: $3, ln:@2.first_line};
      }
      | lvalue "++" {
	 $$ = { t:"++", left: $1, ln:@2.first_line};
      }
      | lvalue "--" {
	 $$ = { t:"--", left: $1, ln:@2.first_line};
      }
      | ID '(' ')' {
	 $$ = { t:"call", f:$1, args:[], ln:@1.first_line};
      }
      | ID '(' listeExpr ')' {
	 $$ = { t:"call", f:$1, args:$3, ln:@1.first_line};
      }
      | for lvalue "in" expr ":" blocOuSingle {
	 $$ = { t:"foreach", compteur:$2, range:$4, do:$6, ln:@1.first_line};
      }
      | for lvalue "in" "range" "(" expr "," expr rangeStep ")" ":" blocOuSingle {
	 $$ = { t:"for", compteur:$2, start:$6, end:$8, do:$12, step:$9, ln:@1.first_line};
      }
      | while expr ":" blocOuSingle {
	 $$ = { t:"while", cond:$2, do:$4, ln:@1.first_line };
      }
      | if expr ":" blocOuSingle {
	 $$ = { t:"if", cond:$2, do:$4, else:[], ln:@1.first_line };
      }
      | if expr ";" blocOuSingle ";" else blocOuSingle {
	 $$ = { t:"if", cond:$2, do:$4, sinon:$7, ln:@1.first_line };
      }
      | break {
	 $$ = {t:"break", ln:@1.first_line};
      }
      | continue {
	 $$ = {t:"continue", ln:@1.first_line};
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
      | "$" {
	 $$ = {t:"$", i:$1};
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

listeExpr
      : expr {
	 $$ = [$1];
      } | listeExpr "," expr {
	 $$ = $1; $$.push($3);
      }
      ;

expr
      : lvalue {
	 $$=$1;
      }
      | STRING {
	 $$={t:"string", val:$1, ln:@1.first_line};
      }
      | NUMBER {
	 $$={t:"number", val:parseFloat($1), ln:@1.first_line};
      }
      | expr "==" expr {
	 $$ = {t:"==", left:$1, right:$3, ln:@2.first_line};
      }
      | expr "=" expr {
	 $$ = {t:"==", left:$1, right:$3, ln:@2.first_line};
      }
      | expr "!=" expr {
	 $$ = {t:"!=", left:$1, right:$3, ln:@2.first_line};
      }
      | expr "<" expr {
	 $$ = {t:"<", left:$1, right:$3, ln:@2.first_line};
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
      | expr "*" expr {
	 $$ = {t:"*", left:$1, right:$3, ln:@2.first_line};
      }
      | expr "/" expr {
	 $$ = {t:"/", left:$1, right:$3, ln:@2.first_line};
      }
      | expr "%" expr {
	 $$ = {t:"%", left:$1, right:$3, ln:@2.first_line};
      }
      | expr "**" expr {
	 $$ = {t:"**", left:$1, right:$3, ln:@2.first_line};
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
	 $$ = {t:"&&", cond:$1, oui:$3, non:$5, ln:@2.first_line};
      }
      | expr "||" expr {
	 $$ = {t:"||", cond:$1, oui:$3, non:$5, ln:@2.first_line};
      }
      | "!" expr {
	 $$ = {t:"!", right:$2, ln:@1.first_line};
      }
      | "(" expr ")" {
	 $$ = $2;
      }
      | ID '(' ')' {
	 $$={t: "call", f:$1, args:[], ln:@1.first_line};
      }
      | ID '(' listeExpr ')' {
	 $$={t: "call", f:$1, args:$3, ln:@1.first_line};
      }
      | "Gamma" "(" expr ")" {
	 $$={t: "Gamma", arg: $3, ln:@1.first_line};
      }
      | "[]" {
	 $$={t: "array", val:[], ln:@1.first_line};
      }
      ;

lvalue
      : id {
	 $$=$1;
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
	 $$={t:"index", tab:$1, index:$3, ln:@2.firt_line};
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
      : instruction {
	 $$ = [$1];
      }
      | ";" "BEGIN" listInst "END" {
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
      | instruction ";" listInst {
	 $$ = $3;
	 $$.unshift($1);
      }
      ;

definition
      : "def" ID listArgs ":" blocOuSingle {
	 $$ = {t:"DEF", nom: $2, args:$3, insts: $5, ln:@1.first_line};
      }
      ;

listArgs
      : "(" ")" {
	 $$=[];
      }
      | "(" listID ")" {
	 $$=$2;
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
      | instruction ";" listeInstOuDef {
	 $$ = $3;
	 $$.unshift($1);
      } 
      | definition ";" listeInstOuDef {
	 $$ = $3;
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

