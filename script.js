async function loadPyodideAndPackages() {
    let pyodide = await loadPyodide();
    return pyodide;
}

async function processFile() {
    const fileInput = document.getElementById("fileInput");
    const startTimestep = parseInt(document.getElementById("startTimestep").value);
    const endTimestep = parseInt(document.getElementById("endTimestep").value);
    const outputDiv = document.getElementById("output");

    if (!fileInput.files[0]) {
        outputDiv.innerText = "Please upload a LAMMPS trajectory file.";
        return;
    }
    if (isNaN(startTimestep) || isNaN(endTimestep) || startTimestep > endTimestep) {
        outputDiv.innerText = "Please enter valid start and end timesteps.";
        return;
    }

    outputDiv.innerText = "Processing...";

    const file = fileInput.files[0];
    const fileContent = await file.text();
    const fileName = file.name;

    let pyodide = await loadPyodideAndPackages();
    pyodide.globals.set("file_content", fileContent);
    pyodide.globals.set("file_name", fileName);
    pyodide.globals.set("start_timestep", startTimestep);
    pyodide.globals.set("end_timestep", endTimestep);

    const pythonCode = `
import js

def parse_lammps(file_content, file_name, start_timestep, end_timestep):
    try:
        xyz_files = []
        found_timesteps = []
        output_log = []
        lines = file_content.split('\\n')
        i = 0
        current_timestep = None
        atoms = []
        xbounds = None
        ybounds = None
        zbounds = None
        N = 0
        reading_atoms = False

        while i < len(lines):
            line = lines[i].strip()
            if not line:
                if reading_atoms and atoms and current_timestep is not None and current_timestep >= start_timestep and current_timestep <= end_timestep:
                    xyz_content = f"{N}\\n"
                    xyz_content += f"Timestep {current_timestep} from {file_name} box {xbounds[0]:.6f} {xbounds[1]:.6f} {ybounds[0]:.6f} {ybounds[1]:.6f} {zbounds[0]:.6f} {zbounds[1]:.6f}\\n"
                    for at in atoms:
                        xyz_content += f"{at[0]} {at[1]:.6f} {at[2]:.6f} {at[3]:.6f}\\n"
                    xyz_filename = f"output_timestep_{current_timestep}.xyz"
                    xyz_files.append((xyz_filename, xyz_content))
                    output_log.append(f"XYZ file generated: {xyz_filename}")
                    found_timesteps.append(current_timestep)
                i += 1
                if i >= len(lines):
                    break
                continue

            if line == "ITEM: TIMESTEP":
                if reading_atoms and atoms and current_timestep is not None and current_timestep >= start_timestep and current_timestep <= end_timestep:
                    xyz_content = f"{N}\\n"
                    xyz_content += f"Timestep {current_timestep} from {file_name} box {xbounds[0]:.6f} {xbounds[1]:.6f} {ybounds[0]:.6f} {ybounds[1]:.6f} {zbounds[0]:.6f} {zbounds[1]:.6f}\\n"
                    for at in atoms:
                        xyz_content += f"{at[0]} {at[1]:.6f} {at[2]:.6f} {at[3]:.6f}\\n"
                    xyz_filename = f"output_timestep_{current_timestep}.xyz"
                    xyz_files.append((xyz_filename, xyz_content))
                    output_log.append(f"XYZ file generated: {xyz_filename}")
                    found_timesteps.append(current_timestep)
                
                i += 1
                if i >= len(lines):
                    break
                ts_line = lines[i].strip()
                try:
                    current_timestep = int(ts_line)
                except ValueError:
                    output_log.append(f"Error: Invalid timestep value at line {i+1}")
                    break
                atoms = []
                reading_atoms = False
                i += 1

            elif line == "ITEM: NUMBER OF ATOMS":
                i += 1
                if i >= len(lines):
                    break
                N_line = lines[i].strip()
                try:
                    N = int(N_line)
                except ValueError:
                    output_log.append(f"Error: Invalid number of atoms at line {i+1}")
                    break
                i += 1

            elif line == "ITEM: BOX BOUNDS pp pp pp":
                i += 1
                if i >= len(lines):
                    break
                try:
                    xbounds = list(map(float, lines[i].strip().split()))
                    i += 1
                    if i >= len(lines):
                        break
                    ybounds = list(map(float, lines[i].strip().split()))
                    i += 1
                    if i >= len(lines):
                        break
                    zbounds = list(map(float, lines[i].strip().split()))
                    i += 1
                except ValueError:
                    output_log.append(f"Error: Invalid box bounds at line {i+1}")
                    break

            elif line == "ITEM: ATOMS id type xs ys zs":
                reading_atoms = True
                for _ in range(N):
                    i += 1
                    if i >= len(lines):
                        break
                    line = lines[i].strip().split()
                    if len(line) < 5:
                        output_log.append(f"Error: Incomplete atom data at line {i+1}")
                        continue
                    try:
                        id_at = int(line[0])
                        type_at = int(line[1])
                        xs = float(line[2])
                        ys = float(line[3])
                        zs = float(line[4])
                        x = xbounds[0] + xs * (xbounds[1] - xbounds[0])
                        y = ybounds[0] + ys * (ybounds[1] - ybounds[0])
                        z = zbounds[0] + zs * (zbounds[1] - zbounds[0])
                        atoms.append((type_at, x, y, z))
                    except (ValueError, IndexError):
                        output_log.append(f"Error: Invalid atom data at line {i+1}")
                        continue
                i += 1
            else:
                i += 1

        if reading_atoms and atoms and current_timestep is not None and current_timestep >= start_timestep and current_timestep <= end_timestep:
            xyz_content = f"{N}\\n"
            xyz_content += f"Timestep {current_timestep} from {file_name} box {xbounds[0]:.6f} {xbounds[1]:.6f} {ybounds[0]:.6f} {ybounds[1]:.6f} {zbounds[0]:.6f} {zbounds[1]:.6f}\\n"
            for at in atoms:
                xyz_content += f"{at[0]} {at[1]:.6f} {at[2]:.6f} {at[3]:.6f}\\n"
            xyz_filename = f"output_timestep_{current_timestep}.xyz"
            xyz_files.append((xyz_filename, xyz_content))
            output_log.append(f"XYZ file generated: {xyz_filename}")
            found_timesteps.append(current_timestep)

        if xyz_files:
            for filename, content in xyz_files:
                try:
                    js.save_file(filename, content)
                    output_log.append(f"Download triggered for: {filename}")
                except Exception as e:
                    output_log.append(f"Error triggering download for {filename}: {str(e)}")
        else:
            output_log.append("No XYZ files were generated.")

        if found_timesteps:
            output_log.append(f"Generated XYZ files for timesteps: {found_timesteps}")
        else:
            output_log.append(f"No timesteps found in the range {start_timestep} to {end_timestep}.")

        return "\\n".join(output_log)
    except Exception as e:
        return f"Unexpected error: {str(e)}"

result = parse_lammps(file_content, file_name, start_timestep, end_timestep)
result
`;

    window.save_file = function(filename, content) {
        try {
            const blob = new Blob([content], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
            return `Download triggered for ${filename}`;
        } catch (error) {
            throw new Error(`Error triggering download for ${filename}: ${error.message}`);
        }
    };

    try {
        const result = await pyodide.runPythonAsync(pythonCode);
        outputDiv.innerText = result;
    } catch (error) {
        outputDiv.innerText = `Python execution error: ${error.message}`;
    }
}
