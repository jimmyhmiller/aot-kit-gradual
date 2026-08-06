function main(limit:number):number {
  let x=1;
  let add=function(amount:number):number { x+=amount; return x; };
  let multiply=function(amount:number):number { x*=amount; return x; };
  let y=0;
  let touch=function():number { y+=1; return y; };
  let factorial=function self(n:number):number { if(n<=1)return 1; return n*self(n-1); };
  return (add(limit)*100000+multiply(3)*100+factorial(5)+touch()-1)|0;
}
