extends SceneTree

# Runner minimal : remplacez/complétez ces contrôles par de vrais tests du jeu.
# Un test doit échouer avec push_error() et quitter avec un code non nul.
func _initialize() -> void:
    var project_file := FileAccess.open("res://project.godot", FileAccess.READ)
    if project_file == null:
        push_error("demande:godot-test-runner — project.godot est illisible")
        quit(1)
        return

    project_file.close()
    print("TEST OK: project.godot accessible")
    print("ATTENTION: ce test de démarrage ne couvre pas encore les mécaniques du jeu.")
    quit(0)
