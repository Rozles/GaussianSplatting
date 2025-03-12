@group(0) @binding(0) var<storage, read_write> indices: array<u32>;
@group(0) @binding(1) var<storage, read> depths: array<f32>;
@group(0) @binding(2) var<uniform> params: vec4<u32>; // size, stage, direction, padding

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  if (idx >= params[0] / 2) {
    return;
  }
  
  let stage = params[1];
  let dir = params[2];
  
  // Bitonic sort algorithm
  var i = idx;
  let j = i ^ stage;
  
  if (j > i) {
    let depthI = depths[indices[i]];
    let depthJ = depths[indices[j]];
    
    // Sort in descending order (farther objects first)
    let shouldSwap = (depthI < depthJ && dir == 0) || (depthI > depthJ && dir == 1);
    
    if (shouldSwap) {
      // Swap indices
      let temp = indices[i];
      indices[i] = indices[j];
      indices[j] = temp;
    }
  }
}