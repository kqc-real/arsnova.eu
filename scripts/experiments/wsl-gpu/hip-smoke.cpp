#include <hip/hip_runtime.h>

#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <vector>

static void check(hipError_t result, const char *operation) {
  if (result != hipSuccess) {
    std::fprintf(stderr, "%s failed: %s\n", operation, hipGetErrorString(result));
    std::exit(1);
  }
}

__global__ void add_vectors(const float *a, const float *b, float *out, int size) {
  int i = blockIdx.x * blockDim.x + threadIdx.x;
  if (i < size) out[i] = a[i] + 2.0f * b[i];
}

int main() {
  std::setvbuf(stdout, nullptr, _IONBF, 0);
  int count = 0;
  check(hipGetDeviceCount(&count), "device enumeration");
  std::printf("HIP devices: %d\n", count);
  // This experiment is deliberately bounded to the user's single GPU setup.
  if (count != 1) {
    std::fprintf(stderr, "Expected one GPU; inspect configuration before testing.\n");
    return 2;
  }
  hipDeviceProp_t properties{};
  check(hipGetDeviceProperties(&properties, 0), "device properties");
  std::printf("GPU: %s; architecture: %s; VRAM: %zu bytes\n", properties.name,
              properties.gcnArchName, properties.totalGlobalMem);
  if (std::strncmp(properties.gcnArchName, "gfx1201", 7) != 0 ||
      std::strstr(properties.name, "9070") == nullptr) {
    std::fprintf(stderr, "Expected RX 9070 family / gfx1201; refusing another GPU.\n");
    return 2;
  }
  check(hipSetDevice(0), "select device");
  constexpr int size = 262144;
  constexpr size_t bytes = size * sizeof(float);
  std::vector<float> a(size), b(size), out(size);
  for (int i = 0; i < size; ++i) {
    a[i] = static_cast<float>(i % 97);
    b[i] = static_cast<float>(i % 19);
  }
  float *device_a = nullptr, *device_b = nullptr, *device_out = nullptr;
  check(hipMalloc(&device_a, bytes), "allocate A");
  check(hipMalloc(&device_b, bytes), "allocate B");
  check(hipMalloc(&device_out, bytes), "allocate output");
  std::puts("Allocated 3 MiB; copying input to GPU.");
  check(hipMemcpy(device_a, a.data(), bytes, hipMemcpyHostToDevice), "copy A");
  check(hipMemcpy(device_b, b.data(), bytes, hipMemcpyHostToDevice), "copy B");
  std::puts("Launching GPU kernel.");
  hipLaunchKernelGGL(add_vectors, dim3((size + 255) / 256), dim3(256), 0, 0,
                     device_a, device_b, device_out, size);
  check(hipGetLastError(), "kernel launch");
  check(hipDeviceSynchronize(), "synchronize");
  check(hipMemcpy(out.data(), device_out, bytes, hipMemcpyDeviceToHost), "copy result");
  for (int i = 0; i < size; ++i) {
    float expected = a[i] + 2.0f * b[i];
    if (!std::isfinite(out[i]) || std::fabs(out[i] - expected) > 1e-5f) {
      std::fprintf(stderr, "Mismatch at %d: expected %g, received %g\n", i,
                   expected, out[i]);
      return 1;
    }
  }
  check(hipFree(device_a), "free A");
  check(hipFree(device_b), "free B");
  check(hipFree(device_out), "free output");
  std::printf("PASS: all %d GPU results match the CPU reference.\n", size);
  return 0;
}
