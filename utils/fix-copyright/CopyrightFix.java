import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.Executors;
import java.util.function.Consumer;

public class CopyrightFix {

    static String nodewotDirectory;

    final static String[] FILE_EXTENSIONS = {".ts"};
    final static String[] DIRECTORY_EXCLUDE = {"node_modules"};

    // Eclipse Copyright
    final static String COPYRIGHT_HEADER_LINE_START = "Copyright (c)";
    final static String COPYRIGHT_HEADER_LINE_END = "Contributors to the Eclipse Foundation";

    static List<File> missingCopyright = new ArrayList<>();

    final static boolean ADD_MISSING_COPYRIGHT = false;
    final static String ECLIPSE_COPYRIGHT = "/********************************************************************************\n" +
            " * Copyright (c) 0000 Contributors to the Eclipse Foundation\n" +
            " * \n" +
            " * See the NOTICE file(s) distributed with this work for additional\n" +
            " * information regarding copyright ownership.\n" +
            " * \n" +
            " * This program and the accompanying materials are made available under the\n" +
            " * terms of the Eclipse Public License v. 2.0 which is available at\n" +
            " * http://www.eclipse.org/legal/epl-2.0, or the W3C Software Notice and\n" +
            " * Document License (2015-05-13) which is available at\n" +
            " * https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document.\n" +
            " * \n" +
            " * SPDX-License-Identifier: EPL-2.0 OR W3C-20150513\n" +
            " ********************************************************************************/\n" +
            "\n";

    static int checkMatchIndex(String line, String match) {
        if (line != null && match != null) {
            return line.indexOf(match);
        }
        return -1;
    }

    static boolean checkLine(String line) {
        if (line != null) {
            int idx1 = checkMatchIndex(line, COPYRIGHT_HEADER_LINE_START);
            int idx2 = checkMatchIndex(line, COPYRIGHT_HEADER_LINE_END);
            return idx1 >= 0 && idx2 >= 0 && idx1 < idx2; // found copyright
        }
        return false;
    }

    static boolean isWindows = System.getProperty("os.name")
            .toLowerCase().startsWith("windows");

    static int getCommitYear(File file, boolean reverse) throws IOException, InterruptedException {
        ProcessBuilder builder = new ProcessBuilder();

        String cmd = "git log ";
        if (reverse) {
            cmd += " --reverse ";
        }
        cmd += file.getAbsolutePath();

        if (isWindows) {
            builder.command("cmd.exe", "/c", cmd);
        } else {
            builder.command("sh", "-c", cmd);
        }

        StringBuilderPlus sb = new StringBuilderPlus();

        // builder.directory(new File(System.getProperty("user.home")));
        builder.directory(new File(nodewotDirectory));

        Process process = builder.start();
        StreamGobbler streamGobbler =
                new StreamGobbler(process.getInputStream(), sb::appendLine); // System.out::println
        Executors.newSingleThreadExecutor().submit(streamGobbler);
        int exitCode = process.waitFor();
        assert exitCode == 0;

        // commit a2f1bed088804cdc388d3db73625f06d2efbbbed
        // Author: danielpeintner <daniel.peintner@gmail.com>
        // Date:   Thu Feb 27 10:17:03 2020 +0100
        //
        //    feat: align with latest scripting API

        String commitHistory = sb.toString();
        // System.out.println(commitHistory);

        String[] lines = commitHistory.split("\\r?\\n");
        for (String line : lines) {
            if (line != null && line.startsWith("Date:")) {
                String dateString = line.replace("Date:", "").trim();
                LocalDate ld = LocalDate.parse(dateString, DateTimeFormatter.ofPattern("EEE MMM d HH:mm:ss yyyy Z", Locale.ENGLISH));
                return ld.getYear();
            }
        }

        throw new IOException("Not possible to parse commit date: " + commitHistory.substring(0, Math.min(commitHistory.length(), 50)));
    }

    static class StringBuilderPlus {

        private final StringBuilder stringBuilder;

        public StringBuilderPlus() {
            this.stringBuilder = new StringBuilder();
        }

        public <T> StringBuilderPlus append(T t) {
            stringBuilder.append(t);
            return this;
        }

        public <T> StringBuilderPlus appendLine(T t) {
            stringBuilder.append(t).append(System.lineSeparator());
            return this;
        }

        @Override
        public String toString() {
            return stringBuilder.toString();
        }

        public StringBuilder getStringBuilder() {
            return stringBuilder;
        }
    }

    private static class StreamGobbler implements Runnable {
        private final InputStream inputStream;
        private final Consumer<String> consumer;

        public StreamGobbler(InputStream inputStream, Consumer<String> consumer) {
            this.inputStream = inputStream;
            this.consumer = consumer;
        }

        @Override
        public void run() {
            new BufferedReader(new InputStreamReader(inputStream)).lines()
                    .forEach(consumer);
        }
    }

    static String getNewLine(String line, int yearCreation, int yearLastModified, boolean useYearRange) {
        int idx1 = checkMatchIndex(line, COPYRIGHT_HEADER_LINE_START);
        String newLine;
        if (yearCreation == yearLastModified || !useYearRange) {
            // one year only
            // e.g., Copyright (c) 2019 Contributors to the Eclipse Foundation
            newLine = line.substring(0, idx1) + COPYRIGHT_HEADER_LINE_START + " " + yearLastModified + " " + COPYRIGHT_HEADER_LINE_END;
        } else {
            // year range
            // e.g., Copyright (c) 2018 - 2019 Contributors to the Eclipse Foundation
            newLine = line.substring(0, idx1) + COPYRIGHT_HEADER_LINE_START + " " + yearCreation + " - " + yearLastModified + " " + COPYRIGHT_HEADER_LINE_END;
        }
        return newLine;
    }

    static void checkCopyrightLine(String line, int lineNumber, File file) throws IOException, InterruptedException {
        if (line != null && file != null) {
            Path path = Paths.get(file.getAbsolutePath());

            // Note: we no longer use year ranges since it is optional, see https://www.eclipse.org/projects/handbook/#ip-copyright-headers
            boolean useYearRange = false;

            int yearCreation = getCommitYear(file, true);
            int yearLastModified = getCommitYear(file, false);

            String newLine = getNewLine(line, yearCreation, yearLastModified, useYearRange);
            if (!line.equals(newLine)) {
                System.out.println(file);
                if (useYearRange) {
                    // Note: need to re-run newLine call since after commit the yearLastModified changes to current year
                    yearLastModified = LocalDate.now().getYear();
                }
                newLine = getNewLine(line, yearCreation, yearLastModified, useYearRange);
                System.out.println("\t change " + line + " --> " + newLine);
                updateCopyrightLine(path, lineNumber, newLine);
            }

        }
    }

    static void updateCopyrightLine(Path path, int lineNumber, String newLine) throws IOException {
        List<String> lines = Files.readAllLines(path, StandardCharsets.UTF_8);
        lines.set(lineNumber, newLine);
        Files.write(path, lines, StandardCharsets.UTF_8);
    }

    static void addCopyrightToFile(File file) throws IOException {
        Path path = Paths.get(file.getAbsolutePath());
        List<String> copyRightLines = Arrays.asList(ECLIPSE_COPYRIGHT.split("\\r?\\n"));
        List<String> lines = Files.readAllLines(path, StandardCharsets.UTF_8);
        lines.addAll(0, copyRightLines);
        Files.write(path, lines, StandardCharsets.UTF_8);
    }

    static boolean isFileOfInterest(File fileEntry) {
        if (fileEntry != null) {
            String fileName = fileEntry.getName();
            for (String fe : FILE_EXTENSIONS) {
                if (fileName.endsWith(fe)) {
                    return true;
                }
            }
        }
        return false;
    }

    static boolean isDirectoryExcluded(File fileEntry) {
        if (fileEntry.isDirectory()) {
            String dirName = fileEntry.getName();
            for (String exc : DIRECTORY_EXCLUDE) {
                if (dirName.endsWith(exc)) {
                    return true;
                }
            }
        }
        return false;
    }

    static void checkFolder(File folder) throws IOException, InterruptedException {
        if (folder == null || !folder.isDirectory()) {
            return;
        }
        File[] files = folder.listFiles();
        if (files != null) {
            for (final File fileEntry : files) {
                if (fileEntry.isDirectory()) {
                    if (!isDirectoryExcluded(fileEntry)) {
                        checkFolder(fileEntry);
                    }
                } else {
                    if (isFileOfInterest(fileEntry)) {
                        // limit to "src" files
                        // Q1: what about test files
                        // Q2: what about deeper nesting in src folder
                        File fileOfInterest = null;
                        // 1 level nesting
                        if (fileEntry.getParentFile() != null && fileEntry.getParentFile().getName().equals("src")) {
                            fileOfInterest = fileEntry;
                        }
                        // 2 level nesting
                        if (fileEntry.getParentFile() != null && fileEntry.getParentFile().getParentFile() != null && fileEntry.getParentFile().getParentFile().getName().equals("src")) {
                            fileOfInterest = fileEntry;
                        }
                        if (fileOfInterest != null) {
                            try (BufferedReader br = new BufferedReader(new FileReader(fileOfInterest))) {
                                // check first lines only
                                // e.g., Copyright (c) 2018 - 2019 Contributors to the Eclipse Foundation
                                String line1 = br.readLine();
                                if (line1 != null) {
                                    if (checkLine(line1)) {
                                        // found copyright
                                        checkCopyrightLine(line1, 0, fileOfInterest);
                                    } else {
                                        String line2 = br.readLine();
                                        if (line2 != null) {
                                            if (checkLine(line2)) {
                                                // found copyright
                                                checkCopyrightLine(line2, 1, fileOfInterest);
                                            } else {
                                                String line3 = br.readLine();
                                                if (checkLine(line3)) {
                                                    // found copyright
                                                    checkCopyrightLine(line3, 2, fileOfInterest);
                                                } else {
                                                    // do not check further
                                                    missingCopyright.add(fileEntry);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    public static void main(String[] args) throws Exception {
        if (args == null || args.length != 1) {
            System.err.println("Error: provide node-wot directory as input");
        } else {
            System.out.println("Start processing files...");
            nodewotDirectory = args[0];
            File rootFolder = new File(nodewotDirectory);
            checkFolder(rootFolder);
            System.out.println("Note: Files with missing copyright:");
            for (File f : missingCopyright) {
                System.out.println(f.getAbsolutePath());
                if (ADD_MISSING_COPYRIGHT) {
                    addCopyrightToFile(f);
                    System.out.println("\tcopyright added");
                }
            }
            System.out.println("Processing finished.");
        }
    }
}
