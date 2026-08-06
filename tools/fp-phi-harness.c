extern double kernel(double a, double b);

int main(void) {
  return kernel(1.0, 2.0) == 1.0 && kernel(3.0, 2.0) == 2.0 ? 0 : 1;
}
