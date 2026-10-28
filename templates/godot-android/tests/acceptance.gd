extends SceneTree

# Modèle volontairement bloquant : le développeur doit le remplacer par un test
# qui prouve la demande en cours et imprimer une étiquette demande:<nom>.
func _initialize() -> void:
    push_error("demande:non-configuree — remplacer tests/acceptance.gd par un test réel propre à la demande")
    quit(1)
