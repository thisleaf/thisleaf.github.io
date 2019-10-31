// ƒ_ƒ[ƒW‚ÌŒvŽZŠÖŒW

// UŒ‚—ÍƒLƒƒƒbƒv
export function sqrtcap(x, cap){
	return x > cap ? cap + Math.sqrt(x - cap) : x;
}

// ã‚Ì‹tŠÖ”
export function inv_sqrtcap(y, cap){
	return y > cap ? (y - cap) * (y - cap) + cap : y;
}

