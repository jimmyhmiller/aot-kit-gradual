#include <mach/mach_time.h>
#include <stdint.h>
#include <stdio.h>
extern int64_t kernel(int64_t, int64_t);
int main(void) {
  mach_timebase_info_data_t tb; mach_timebase_info(&tb);
  const int64_t n = 5000000; volatile int64_t sink = 0;
  for (int warm=0;warm<3;warm++) for(int64_t i=0;i<n/10;i++) sink += kernel(i,i+1);
  for (int sample=0;sample<9;sample++) { uint64_t a=mach_absolute_time();
    for(int64_t i=0;i<n;i++) sink += kernel(i,i+1); uint64_t b=mach_absolute_time();
    double ns=(double)(b-a)*tb.numer/tb.denom; printf("%.6f\n",ns/n); }
  return sink == 0;
}
