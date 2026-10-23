// Expand classic scripts in their original HTML positions for existing flow tests.
const fs=require('fs'),path=require('path');
module.exports=function(page){
 const root=path.join(__dirname,'..');
 return fs.readFileSync(path.join(root,'web',page),'utf8').replace(/<script\b([^>]*?)\s+src="\/assets\/frontend\/([^"]+)"([^>]*)><\/script>/gi,
  (_,before,name,after)=>'<script'+before+after+'>'+fs.readFileSync(path.join(root,'assets/frontend',name),'utf8')+'</script>');
};
