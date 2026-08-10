#include <CoreFoundation/CoreFoundation.h>
#include <stdint.h>
#include <stdlib.h>

// Platform Unicode service used by the JSL StringNormalize primitive. `form` follows the DSL's
// compact representation: 0=NFC, 1=NFD, 2=NFKC, 3=NFKD. The caller owns `*output`.
int64_t aot_unicode_normalize(const uint16_t *input, int64_t length, int64_t form,
                              uint16_t **output) {
  if (!output || length < 0 || form < 0 || form > 3) return -1;
  *output = NULL;
  CFMutableStringRef string = CFStringCreateMutable(kCFAllocatorDefault, 0);
  if (!string) return -1;
  if (length) CFStringAppendCharacters(string, (const UniChar *)input, (CFIndex)length);
  CFStringNormalizationForm cf_form = form == 0 ? kCFStringNormalizationFormC
                                     : form == 1 ? kCFStringNormalizationFormD
                                     : form == 2 ? kCFStringNormalizationFormKC
                                                 : kCFStringNormalizationFormKD;
  CFStringNormalize(string, cf_form);
  CFIndex result_length = CFStringGetLength(string);
  uint16_t *result = result_length ? malloc((size_t)result_length * sizeof(*result)) : NULL;
  if (result_length && !result) {
    CFRelease(string);
    return -1;
  }
  if (result_length)
    CFStringGetCharacters(string, CFRangeMake(0, result_length), (UniChar *)result);
  CFRelease(string);
  *output = result;
  return (int64_t)result_length;
}

void aot_unicode_free(uint16_t *memory) { free(memory); }
