export default function BrandWordmark({size=23}:{size?:number}) {
  return <span style={{fontFamily:'Arial, Helvetica, sans-serif',fontSize:size,letterSpacing:'-1px',lineHeight:1,whiteSpace:'nowrap'}}><span style={{fontWeight:750}}>Club</span><span style={{fontWeight:400}}>Smart</span></span>;
}
