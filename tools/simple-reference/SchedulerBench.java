import com.seaofnodes.simple.codegen.CodeGen;
import com.seaofnodes.simple.node.CFGNode;
import java.nio.file.Files;
import java.nio.file.Path;

public final class SchedulerBench {
  private static double millis(long start) { return (System.nanoTime() - start) / 1_000_000.0; }

  public static void main(String[] args) throws Exception {
    String source = Files.readString(Path.of(args[0]));
    int width = Integer.parseInt(args[1]);
    CodeGen code = new CodeGen(source);
    long started = System.nanoTime();
    code.parse().opto().typeCheck().loopTree();
    double frontendMs = millis(started);
    started = System.nanoTime();
    code.instSelect("arm", "SystemV");
    double selectionMs = millis(started);
    started = System.nanoTime();
    code.GCM();
    double gcmMs = millis(started);
    int blocks = 0;
    int scheduledNodes = 0;
    int maxBlockWidth = 0;
    for (CFGNode block : code._cfg) {
      if (!block.blockHead()) continue;
      blocks++;
      int blockWidth = block.nOuts();
      scheduledNodes += blockWidth;
      maxBlockWidth = Math.max(maxBlockWidth, blockWidth);
    }
    started = System.nanoTime();
    code.localSched();
    double localScheduleMs = millis(started);
    System.out.printf(
      "{\"width\":%d,\"blocks\":%d,\"scheduledNodes\":%d,\"maxBlockWidth\":%d," +
      "\"frontendMs\":%.3f,\"selectionMs\":%.3f,\"gcmMs\":%.3f,\"localScheduleMs\":%.3f}%n",
      width, blocks, scheduledNodes, maxBlockWidth, frontendMs, selectionMs, gcmMs, localScheduleMs);
  }
}
