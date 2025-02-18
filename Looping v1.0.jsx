{
    // -------------------------------
    // Fonctions utilitaires
    // -------------------------------
    
    // Récupère tous les calques sélectionnés dans la composition active
    function getSelectedLayers() {
        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) {
            alert("Veuillez sélectionner une composition.");
            return null;
        }
        if (comp.selectedLayers.length < 1) {
            alert("Veuillez sélectionner au moins un calque.");
            return null;
        }
        return comp.selectedLayers;
    }
    
    // -------------------------------
    // Section 1 : Boucle sur le remappage temporel
    // -------------------------------
    
    function appliquerBoucleRemappageTemporel() {
        var layers = getSelectedLayers();
        if (!layers) return;
        
        app.beginUndoGroup("Boucle Remappage Temporel");
        
        // Pour chaque calque sélectionné
        for (var i = 0; i < layers.length; i++) {
            var layer = layers[i];
            if (!layer.timeRemapEnabled) {
                layer.timeRemapEnabled = true;
            }
            var tr = layer.property("ADBE Time Remapping");
            if (tr) {
                tr.expression = "";
                // On récupère le type de boucle choisi dans le menu déroulant (Cycle ou Pingpong uniquement)
                var typeBoucle = dropdownTR.selection.text.toLowerCase();
                var expr = 'loopOutDuration("' + typeBoucle + '", 0)-(thisComp.frameDuration);';
                tr.expression = expr;
            }
        }
        app.endUndoGroup();
    }
    
    // -------------------------------
    // Section 2 : Boucle sur les keyframes
    // -------------------------------
    
    // Applique l'expression loopOut à une propriété animée, si elle possède des keyframes
    function appliquerExpressionBoucle(property, type) {
        if (property.numKeys > 0) {
            property.expression = "";
            var expr = "";
            // Si la propriété est un tracé vectoriel (path)
            if (property.propertyValueType === PropertyValueType.SHAPE) {
                if (type === "pingpong") {
                    expr = "pingPong = true;\n" +
                           "try{\n" +
                           "  timeStart = thisProperty.key(1).time;\n" +
                           "  duration = thisProperty.key(thisProperty.numKeys).time - timeStart;\n" +
                           "  quant = Math.floor((time - timeStart) / duration);\n" +
                           "  if(quant < 0) quant = 0;\n" +
                           "  if(quant % 2 == 1 && pingPong == true){\n" +
                           "    t = 2 * timeStart + (quant + 1) * duration - time;\n" +
                           "  } else {\n" +
                           "    t = time - quant * duration;\n" +
                           "  }\n" +
                           "} catch(e){\n" +
                           "  t = time;\n" +
                           "}\n" +
                           "thisProperty.valueAtTime(t);";
                } else if (type === "cycle") {
                    expr = "pingPong = false;\n" +
                           "try{\n" +
                           "  timeStart = thisProperty.key(1).time;\n" +
                           "  duration = thisProperty.key(thisProperty.numKeys).time - timeStart;\n" +
                           "  quant = Math.floor((time - timeStart) / duration);\n" +
                           "  if(quant < 0) quant = 0;\n" +
                           "  if(quant % 2 == 1 && pingPong == true){\n" +
                           "    t = 2 * timeStart + (quant + 1) * duration - time;\n" +
                           "  } else {\n" +
                           "    t = time - quant * duration;\n" +
                           "  }\n" +
                           "} catch(e){\n" +
                           "  t = time;\n" +
                           "}\n" +
                           "thisProperty.valueAtTime(t);";
                } else {
                    alert("L'option de boucle '" + type + "' est impossible pour un tracé vectoriel.");
                    property.expression = "";
                    return;
                }
            } else {
                if (type === "continue") {
                    expr = 'loopOut("continue", 0);';
                } else {
                    expr = 'loopOut("' + type + '", 0);';
                }
            }
            property.expression = expr;
        }
    }
    
    function appliquerBoucleKeyframes() {
        var layers = getSelectedLayers();
        if (!layers) return;
        
        app.beginUndoGroup("Boucle Keyframes");
        var comp = app.project.activeItem;
        var typeBoucleKey = dropdownKey.selection.text.toLowerCase();
        var trouveAuMoinsUne = false;
        
        // Pour chaque calque sélectionné
        for (var i = 0; i < layers.length; i++) {
            var layer = layers[i];
            var props = [];
            // Propriétés fixes via cases à cocher
            if (cbPosition.value) { props.push(layer.transform.position); }
            if (cbScale.value)    { props.push(layer.transform.scale); }
            if (cbRotation.value) { props.push(layer.transform.rotation); }
            if (cbOpacity.value && layer.opacity) { props.push(layer.opacity); }
            if (cbAnchor.value)   { props.push(layer.transform.anchorPoint); }
            // Propriétés actuellement sélectionnées dans la timeline
            if (cbSelected.value) {
                var selProps = comp.selectedProperties;
                for (var j = 0; j < selProps.length; j++) {
                    try {
                        if (selProps[j].propertyGroup(selProps[j].propertyDepth) === layer) {
                            props.push(selProps[j]);
                        }
                    } catch(e) {
                        // Ignorer les erreurs
                    }
                }
            }
            
            // Éliminer les doublons
            var uniqueProps = [];
            for (var k = 0; k < props.length; k++) {
                var p = props[k];
                var existe = false;
                for (var l = 0; l < uniqueProps.length; l++) {
                    if (uniqueProps[l] === p) { existe = true; break; }
                }
                if (!existe) uniqueProps.push(p);
            }
            
            if (uniqueProps.length > 0) { trouveAuMoinsUne = true; }
            // Applique l'expression à chaque propriété animée
            for (var m = 0; m < uniqueProps.length; m++) {
                var property = uniqueProps[m];
                if (property.numKeys > 0) {
                    appliquerBoucleExpression(property, typeBoucleKey);
                }
            }
        }
        if (!trouveAuMoinsUne) {
            alert("Veuillez sélectionner au moins une propriété animée.");
        }
        app.endUndoGroup();
    }
    
    // Wrapper pour appliquer l'expression de boucle, afin de séparer la fonction existante
    function appliquerBoucleExpression(property, type) {
        appliquerBoucleExpression(property, type); // Appel de la fonction déjà définie
        // Pour simplifier, on appelle directement appliquerBoucleExpression(property, type) qui effectue l'opération.
        // (Cette fonction est définie ci-dessus dans appliquerBoucleExpression, mais pour éviter la récursivité, nous renommons ici notre fonction.)
    }
    
    // Pour éviter une récursivité, on renomme notre fonction d'application pour keyframes
    function appliquerBoucleExpression(property, type) {
        if (property.numKeys > 0) {
            property.expression = "";
            var expr = "";
            if (property.propertyValueType === PropertyValueType.SHAPE) {
                if (type === "pingpong") {
                    expr = "pingPong = true;\n" +
                           "try{\n" +
                           "  timeStart = thisProperty.key(1).time;\n" +
                           "  duration = thisProperty.key(thisProperty.numKeys).time - timeStart;\n" +
                           "  quant = Math.floor((time - timeStart) / duration);\n" +
                           "  if(quant < 0) quant = 0;\n" +
                           "  if(quant % 2 == 1 && pingPong == true){\n" +
                           "    t = 2 * timeStart + (quant + 1) * duration - time;\n" +
                           "  } else {\n" +
                           "    t = time - quant * duration;\n" +
                           "  }\n" +
                           "} catch(e){\n" +
                           "  t = time;\n" +
                           "}\n" +
                           "thisProperty.valueAtTime(t);";
                } else if (type === "cycle") {
                    expr = "pingPong = false;\n" +
                           "try{\n" +
                           "  timeStart = thisProperty.key(1).time;\n" +
                           "  duration = thisProperty.key(thisProperty.numKeys).time - timeStart;\n" +
                           "  quant = Math.floor((time - timeStart) / duration);\n" +
                           "  if(quant < 0) quant = 0;\n" +
                           "  if(quant % 2 == 1 && pingPong == true){\n" +
                           "    t = 2 * timeStart + (quant + 1) * duration - time;\n" +
                           "  } else {\n" +
                           "    t = time - quant * duration;\n" +
                           "  }\n" +
                           "} catch(e){\n" +
                           "  t = time;\n" +
                           "}\n" +
                           "thisProperty.valueAtTime(t);";
                } else {
                    alert("L'option de boucle '" + type + "' est impossible pour un tracé vectoriel.");
                    property.expression = "";
                    return;
                }
            } else {
                if (type === "continue") {
                    expr = 'loopOut("continue", 0);';
                } else {
                    expr = 'loopOut("' + type + '", 0);';
                }
            }
            property.expression = expr;
        }
    }
    
    // -------------------------------
    // Section 3 : Effacer toutes les boucles
    // -------------------------------
    
    function effacerBouclesDansGroupe(propGroup) {
        for (var i = 1; i <= propGroup.numProperties; i++) {
            var prop = propGroup.property(i);
            if (prop.propertyType === PropertyType.PROPERTY) {
                if (prop.canSetExpression && prop.expression !== "") {
                    var expr = prop.expression.toLowerCase();
                    if (expr.indexOf("loopout") === 0) {
                        prop.expression = "";
                    }
                }
            } else if (prop.propertyType === PropertyType.INDEXED_GROUP || prop.propertyType === PropertyType.NAMED_GROUP) {
                effacerBouclesDansGroupe(prop);
            }
        }
    }
    
    function effacerToutesLesBoucles() {
        var layers = getSelectedLayers();
        if (!layers) return;
        
        app.beginUndoGroup("Effacer toutes les boucles");
        for (var i = 0; i < layers.length; i++) {
            var layer = layers[i];
            effacerBouclesDansGroupe(layer);
        }
        app.endUndoGroup();
    }
    
    // -------------------------------
    // Interface utilisateur
    // -------------------------------
    
    var myPanel = (this instanceof Panel) ? this : new Window("palette", "Loop Panel", undefined, {resizeable:true});
    myPanel.orientation = "column";
    myPanel.alignChildren = ["fill", "top"];
    
    // Section 1 : Boucle Remappage Temporel
    var grpTR = myPanel.add("panel", undefined, "Boucle Remappage Temporel");
    grpTR.orientation = "column";
    grpTR.alignChildren = ["fill", "top"];
    grpTR.margins = 10;
    
    var dropdownTR = grpTR.add("dropdownlist", undefined, ["Cycle", "Pingpong"]);
    dropdownTR.selection = 0;
    
    var btnTR = grpTR.add("button", undefined, "Appliquer Boucle TR", {preferredSize:[200,30]});
    btnTR.onClick = appliquerBoucleRemappageTemporel;
    
    // Section 2 : Boucle Keyframes
    var grpKey = myPanel.add("panel", undefined, "Boucle Keyframes");
    grpKey.orientation = "column";
    grpKey.alignChildren = ["fill", "top"];
    grpKey.margins = 10;
    
    var groupeCB = grpKey.add("group");
    groupeCB.orientation = "row";
    groupeCB.alignChildren = ["left", "center"];
    groupeCB.spacing = 10;
    
    var cbPosition = groupeCB.add("checkbox", undefined, "Position");
    cbPosition.value = true;
    var cbScale = groupeCB.add("checkbox", undefined, "Échelle");
    cbScale.value = true;
    var cbRotation = groupeCB.add("checkbox", undefined, "Rotation");
    cbRotation.value = true;
    var cbOpacity = groupeCB.add("checkbox", undefined, "Opacité");
    cbOpacity.value = false;
    var cbAnchor = groupeCB.add("checkbox", undefined, "Point d'Ancrage");
    cbAnchor.value = false;
    var cbSelected = groupeCB.add("checkbox", undefined, "Propriété(s) sélectionnée(s)");
    cbSelected.value = false;
    
    var dropdownKey = grpKey.add("dropdownlist", undefined, ["Cycle", "Pingpong", "Offset", "Continue"]);
    dropdownKey.selection = 0;
    
    var btnKey = grpKey.add("button", undefined, "Appliquer Boucle Keyframes", {preferredSize:[200,30]});
    btnKey.onClick = appliquerBoucleKeyframes;
    
    // Section 3 : Effacer toutes les boucles
    var grpClear = myPanel.add("panel", undefined, "Effacer toutes les boucles");
    grpClear.orientation = "column";
    grpClear.alignChildren = ["fill", "top"];
    grpClear.margins = 10;
    
    var btnClear = grpClear.add("button", undefined, "Effacer toutes les boucles", {preferredSize:[200,30]});
    btnClear.onClick = effacerToutesLesBoucles;
    
    myPanel.layout.layout(true);
    if (myPanel instanceof Window) {
        myPanel.center();
        myPanel.show();
    }
}
