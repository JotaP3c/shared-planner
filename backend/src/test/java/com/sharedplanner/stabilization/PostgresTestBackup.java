package com.sharedplanner.stabilization;

import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.TimeUnit;

/** Backup guard for disposable databases, never accepts an application database. */
public final class PostgresTestBackup {
    private PostgresTestBackup() {}
    public static Path create(String database, String schema) {
        if(!Set.of("audit_migration_test","phase3_stabilization_test").contains(database))throw new IllegalArgumentException("Unsafe database");
        try {
            String bin=Objects.requireNonNull(System.getenv("PLANNER_TEST_PG_BIN"),"PostgreSQL tools required");
            Path directory=Path.of(Objects.requireNonNull(System.getenv("PLANNER_PHASE3_EVIDENCE"),"Private evidence directory required"));
            Files.createDirectories(directory);
            Path dump=Files.createTempFile(directory,"before-"+database+"-",".dump");
            var args=new ArrayList<>(List.of(Path.of(bin,"pg_dump.exe").toString(),"-h","127.0.0.1","-p","54629","-U","planner_test","-d",database,"-Fc","-f",dump.toString()));
            if(schema!=null){args.add("-n");args.add(schema);}
            run(args); run(List.of(Path.of(bin,"pg_restore.exe").toString(),"--list",dump.toString()));
            String hash=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(dump)));
            Files.writeString(Path.of(dump+".sha256"),hash+"  "+dump.getFileName()+"\n");
            return dump;
        } catch(Exception exception){throw new IllegalStateException("Verified pre-migration backup failed",exception);}
    }
    public static void restoreForVerification(Path dump) {
        try {
            Path evidence=Path.of(System.getenv("PLANNER_PHASE3_EVIDENCE")).toAbsolutePath().normalize();
            if(!dump.toAbsolutePath().normalize().startsWith(evidence))throw new IllegalArgumentException("Unsafe backup path");
            run(List.of(Path.of(System.getenv("PLANNER_TEST_PG_BIN"),"pg_restore.exe").toString(),
                    "-h","127.0.0.1","-p","54629","-U","planner_test","-d","phase3_backup_restore",
                    "--exit-on-error","--single-transaction",dump.toString()));
        } catch(Exception exception){throw new IllegalStateException("Isolated restore verification failed",exception);}
    }
    private static void run(List<String> command) throws Exception {
        Path log=Files.createTempFile(Path.of(System.getenv("PLANNER_PHASE3_EVIDENCE")),"backup-tool-",".log");
        Process process=new ProcessBuilder(command).redirectErrorStream(true).redirectOutput(log.toFile()).start();
        if(!process.waitFor(30,TimeUnit.SECONDS)){process.destroyForcibly();throw new IllegalStateException("Backup tool timed out");}
        if(process.exitValue()!=0)throw new IllegalStateException(Files.readString(log));
    }
}
